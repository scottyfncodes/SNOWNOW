import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { DEFAULT_WEIGHTS } from '@/config/weights';
import { MOUNTAINS } from '@/data/mountains';
import { createDemoRegistry } from '@/providers/demo';

/**
 * SNOWNOW opens straight onto the Colorado map — that map is the homepage
 * and the mountain selector. These tests walk the product's actual promise:
 * open it, see Colorado, tap a mountain, get the whole story for that one
 * mountain — never a NOW/LATER choice standing between the user and an
 * answer.
 */

const user = () => userEvent.setup();

async function selectMountain(name: string | RegExp) {
  render(<App />);
  await user().click(screen.getByRole('button', { name: new RegExp(`^${name}\. Tap to view`, 'i') }));
  // The full day plan (score, snow, weather, drive timing) loads after the
  // quick route preview — this text only exists once that has resolved.
  return waitFor(() => expect(screen.getAllByText(/out of 10/i).length).toBeGreaterThan(0), {
    timeout: 12_000,
  });
}

describe('the homepage', () => {
  it('opens directly onto the Colorado map, with no NOW/LATER choice anywhere', () => {
    render(<App />);
    expect(screen.getByText("Colorado's mountains. Pick one.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^NOW$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^LATER$/i })).not.toBeInTheDocument();
    for (const mountain of MOUNTAINS) {
      expect(screen.getByRole('button', { name: new RegExp(`^${mountain.name}\. Tap to view`, 'i') })).toBeInTheDocument();
    }
  });

  it('says plainly that it is running on demo data', () => {
    render(<App />);
    expect(screen.getByText('DEMO DATA')).toBeInTheDocument();
    expect(screen.getByText(/No live weather, traffic or lift feeds/i)).toBeInTheDocument();
  });

  it('offers only "use my current location" — no manual city list', () => {
    render(<App />);
    expect(screen.getByRole('button', { name: /use my current location/i })).toBeInTheDocument();
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });
});

describe('GPS location flow', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    // @ts-expect-error -- test cleanup of a jsdom global that has no type by default
    delete navigator.geolocation;
  });

  it('routes from the actual GPS fix once granted', async () => {
    const getCurrentPosition = vi.fn((success: PositionCallback) => {
      success({
        coords: { latitude: 39.7047, longitude: -105.0814, accuracy: 10 },
      } as GeolocationPosition);
    });
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    render(<App />);
    await user().click(screen.getByRole('button', { name: /use my current location/i }));
    await waitFor(() => expect(screen.getByText(/using your current location/i)).toBeInTheDocument());

    const vail = MOUNTAINS.find((m) => m.id === 'vail')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${vail.name}\. Tap to view`, 'i') }));
    await waitFor(() => expect(screen.getByText('Drive time')).toBeInTheDocument());
    expect(screen.getAllByText(/your location/i).length).toBeGreaterThan(0);
  });

  it('shows an actionable message and stays on the map when location permission is denied', async () => {
    const getCurrentPosition = vi.fn(
      (_success: PositionCallback, error: PositionErrorCallback) => {
        error({ code: 1, PERMISSION_DENIED: 1, message: 'denied' } as GeolocationPositionError);
      },
    );
    vi.stubGlobal('navigator', { ...navigator, geolocation: { getCurrentPosition } });

    render(<App />);
    await user().click(screen.getByRole('button', { name: /use my current location/i }));
    await waitFor(() =>
      expect(screen.getByText(/location access is off/i)).toBeInTheDocument(),
    );

    // No manual city fallback exists — the map and its mountains stay usable regardless.
    expect(screen.getByText("Colorado's mountains. Pick one.")).toBeInTheDocument();
    for (const mountain of MOUNTAINS) {
      expect(screen.getByRole('button', { name: new RegExp(`^${mountain.name}\. Tap to view`, 'i') })).toBeInTheDocument();
    }
  });
});

describe('the mountain profile', () => {
  it('answers with a mountain, a score and a verdict', async () => {
    await selectMountain('Vail');
    expect(screen.getByRole('heading', { name: 'VAIL' })).toBeInTheDocument();
    expect(screen.getAllByText(/out of 10/i).length).toBeGreaterThan(0);
  });

  it('never claims demo numbers are live', async () => {
    await selectMountain('Vail');
    expect(screen.getAllByText('DEMO DATA').length).toBeGreaterThan(0);
    expect(screen.queryByText(/^LIVE$/)).not.toBeInTheDocument();
  });

  it('renders the snow clock and the timeline', async () => {
    await selectMountain('Vail');
    expect(screen.getByRole('heading', { name: /the snow clock/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your day/i })).toBeInTheDocument();
  });

  it('shows the drive, the traffic and the route from the origin', async () => {
    await selectMountain('Vail');
    expect(screen.getByText('Drive time')).toBeInTheDocument();
    expect(screen.getByText('Distance')).toBeInTheDocument();
    expect(screen.getAllByText(/^Leave /).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /when to head home/i })).toBeInTheDocument();
  });

  it('shows parking, the trail map and lift ticket links for the mountain', async () => {
    await selectMountain('Vail');
    expect(screen.getByText('Parking')).toBeInTheDocument();
    expect(screen.getByText(/Trail map/i)).toBeInTheDocument();
    expect(screen.getByText(/Lift tickets/i)).toBeInTheDocument();
  });

  it('shows what the day costs', async () => {
    await selectMountain('Vail');
    expect(screen.getAllByText(/lift ticket/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/^\$\d+$/)).toBeInTheDocument();
  });

  it('can take the score apart on request', async () => {
    await selectMountain('Vail');
    const disclosure = screen.getByRole('button', { name: /how we got/i });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await user().click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/decision support/i)).toBeInTheDocument();
  });

  it('lets you close the profile and return to the map, then open a different mountain', async () => {
    await selectMountain('Vail');
    await user().click(screen.getByRole('button', { name: /^close$/i }));
    expect(screen.queryByRole('heading', { name: 'VAIL' })).not.toBeInTheDocument();

    const breck = MOUNTAINS.find((m) => m.id === 'breckenridge')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${breck.name}\. Tap to view`, 'i') }));
    await waitFor(() => expect(screen.getByRole('heading', { name: breck.shortName })).toBeInTheDocument());
    expect(screen.queryByRole('heading', { name: 'VAIL' })).not.toBeInTheDocument();
  });
});

describe('accessibility basics', () => {
  it('exposes the recommendation as text for screen readers', async () => {
    await selectMountain('Vail');
    const status = screen.getAllByRole('status')[0]!;
    expect(status.textContent).toMatch(/out of 10/i);
    expect(status.textContent).toMatch(/Leave /);
  });

  it('describes the charts rather than leaving them as bare SVG', async () => {
    await selectMountain('Vail');
    expect(screen.getByRole('img', { name: /ski quality through the day/i })).toBeInTheDocument();
  });

  it('gives every score bar a meter role with a value', async () => {
    await selectMountain('Vail');
    await user().click(screen.getByRole('button', { name: /how we got/i }));
    const meters = screen.getAllByRole('meter');
    // One per configured factor — derived, so adding a factor updates the test.
    expect(meters.length).toBe(Object.keys(DEFAULT_WEIGHTS.factors).length);
    for (const meter of meters) {
      expect(meter).toHaveAttribute('aria-valuenow');
      expect(meter).toHaveAttribute('aria-label');
    }
  });
});

describe('honest empty states', () => {
  async function selectVailWith(registry: ReturnType<typeof createDemoRegistry>) {
    render(<App registry={registry} />);
    await user().click(screen.getByRole('button', { name: /^Vail\. Tap to view/i }));
    await waitFor(() => expect(screen.getByRole('heading', { name: 'VAIL' })).toBeInTheDocument(), {
      timeout: 12_000,
    });
  }

  it('says the weather feed is down instead of inventing snow', async () => {
    await selectVailWith(createDemoRegistry({ weather: { failFor: () => true } }));
    expect(screen.getByText(/Weather's being weird/i)).toBeInTheDocument();
  });

  it('refuses to fake the drive when road data is missing', async () => {
    await selectVailWith(createDemoRegistry({ traffic: { failFor: () => true } }));
    expect(screen.getByText(/we're not going to fake the drive/i)).toBeInTheDocument();
    expect(screen.getByText(/can't time this day/i)).toBeInTheDocument();
    expect(screen.queryByText('Head home')).not.toBeInTheDocument();
  });

  it('says the price is unavailable rather than inventing one when pricing is down', async () => {
    await selectVailWith(createDemoRegistry({ pricing: { failFor: () => true } }));
    // No dollar figure anywhere — the honest fallback names the gap instead of a number.
    expect(screen.queryByText(/^\$\d/)).not.toBeInTheDocument();
    expect(screen.getByText(/Current price unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/Ticket pricing isn't loading/i)).toBeInTheDocument();
  });

  it('does not show a parking availability number it cannot back up', async () => {
    await selectMountain('Vail');
    expect(screen.queryByText(/\d+ spots? available/i)).not.toBeInTheDocument();
  });
});
