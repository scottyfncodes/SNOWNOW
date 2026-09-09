import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { DEFAULT_PREFERENCES } from '@/config/weights';
import { MOUNTAINS } from '@/data/mountains';
import { findOrigin, gpsOrigin } from '@/data/origins';
import { at } from '@/domain/time';
import { toDateKey } from '@/domain/dates';
import { createDemoRegistry, createLiveRegistry } from '@/providers';
import type { ProviderRegistry } from '@/providers/types';
import { unavailable } from '@/domain/provenance';
import { MapScreen } from './MapScreen';

const user = () => userEvent.setup();
const clock = { today: toDateKey(new Date('2026-01-17')), now: at(7, 0) };
const preferences = { ...DEFAULT_PREFERENCES };

function renderMap(
  props: Partial<React.ComponentProps<typeof MapScreen>> = {},
) {
  return render(
    <MapScreen
      registry={createDemoRegistry()}
      clock={clock}
      origin={findOrigin('denver')}
      onOriginChange={() => {}}
      preferences={preferences}
      usingDemoData={true}
      {...props}
    />,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('MapScreen', () => {
  it('is the homepage: the Colorado map is there immediately, with no NOW/LATER choice', () => {
    renderMap();
    expect(screen.getByText('DEMO DATA')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^NOW$/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^LATER$/i })).not.toBeInTheDocument();
  });

  it('shows every supported mountain as a selectable marker, each exactly once', () => {
    renderMap();
    for (const mountain of MOUNTAINS) {
      expect(screen.getByRole('button', { name: new RegExp(`^${mountain.name}\. Tap to view`, 'i') })).toBeInTheDocument();
    }
  });

  it('the undocumented O in the wordmark filters the map to Epic Pass mountains and back', async () => {
    renderMap();
    const epicMountains = MOUNTAINS.filter((mountain) => mountain.passAffiliations.includes('epic'));
    const nonEpicMountain = MOUNTAINS.find((mountain) => !mountain.passAffiliations.includes('epic'))!;
    expect(epicMountains.length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: new RegExp(`^${nonEpicMountain.name}\\. Tap to view`, 'i') })).toBeInTheDocument();

    const toggle = screen.getByRole('button', { name: /show epic pass mountains only/i });
    await user().click(toggle);

    expect(screen.getByText('EPIC ONLY')).toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: new RegExp(`^${nonEpicMountain.name}\\. Tap to view`, 'i') }),
    ).not.toBeInTheDocument();
    for (const mountain of epicMountains) {
      expect(screen.getByRole('button', { name: new RegExp(`^${mountain.name}\\. Tap to view`, 'i') })).toBeInTheDocument();
    }

    await user().click(screen.getByRole('button', { name: /showing epic pass mountains only/i }));
    expect(screen.queryByText('EPIC ONLY')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: new RegExp(`^${nonEpicMountain.name}\\. Tap to view`, 'i') })).toBeInTheDocument();
  });

  it('the list view button swaps the map for an alphabetized list, and back', async () => {
    renderMap();
    const vail = MOUNTAINS.find((m) => m.id === 'vail')!;
    expect(screen.getByRole('button', { name: new RegExp(`^${vail.name}\\. Tap to view`, 'i') })).toBeInTheDocument();

    await user().click(screen.getByRole('button', { name: /^list view$/i }));

    // The map's own hidden mountain buttons are gone — the list replaces the map entirely.
    expect(screen.queryByRole('button', { name: new RegExp(`^${vail.name}\\. Tap to view`, 'i') })).not.toBeInTheDocument();

    const rows = screen.getAllByRole('button').map((button) => button.textContent ?? '');
    const withMountainNames = rows.filter((text) => MOUNTAINS.some((m) => text.startsWith(m.name)));
    expect(withMountainNames.length).toBe(MOUNTAINS.length);
    // Alphabetical: Arapahoe Basin sorts before Vail.
    const arapahoeIndex = rows.findIndex((text) => text.startsWith('Arapahoe Basin'));
    const vailIndex = rows.findIndex((text) => text.startsWith('Vail'));
    expect(arapahoeIndex).toBeGreaterThanOrEqual(0);
    expect(arapahoeIndex).toBeLessThan(vailIndex);

    await user().click(screen.getByRole('button', { name: new RegExp(`^${vail.name}`) }));
    expect(await screen.findByRole('heading', { name: new RegExp(`^${vail.name}`) })).toBeInTheDocument();
  });

  it('scrolls back to the top when a mountain is selected from a scrolled-down list', async () => {
    const scrollTo = vi.fn();
    vi.stubGlobal('scrollTo', scrollTo);
    renderMap();
    await user().click(screen.getByRole('button', { name: /^list view$/i }));

    const vail = MOUNTAINS.find((m) => m.id === 'vail')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${vail.name}`) }));

    expect(scrollTo).toHaveBeenCalledWith(0, 0);
  });

  it('re-shows the map after returning from a mountain opened from the list', async () => {
    renderMap();
    await user().click(screen.getByRole('button', { name: /^list view$/i }));
    const vail = MOUNTAINS.find((m) => m.id === 'vail')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${vail.name}`) }));
    await screen.findByRole('heading', { name: new RegExp(`^${vail.name}`) });

    await user().click(screen.getByRole('button', { name: /^Map$/i }));
    expect(screen.getByRole('button', { name: /^map view$/i })).toBeInTheDocument();
  });

  it('opens the mountain profile in place when a mountain is selected, with drive time, distance and traffic', async () => {
    renderMap();
    const vail = MOUNTAINS.find((m) => m.id === 'vail')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${vail.name}\. Tap to view`, 'i') }));

    await waitFor(() => expect(screen.getByText('Drive time')).toBeInTheDocument());
    expect(screen.getByText('Distance')).toBeInTheDocument();
    // Demo data is honestly labelled as a demo estimate, never claimed traffic-aware.
    expect(screen.getByText('Demo estimate')).toBeInTheDocument();

    expect(screen.getByRole('heading', { name: new RegExp(`^${vail.name}`) })).toBeInTheDocument();
    expect(screen.getByText('Official site ↗')).toBeInTheDocument();
  });

  it('answers the whole question for the selected mountain: snow, weather, recommendation, tickets, parking and alerts', async () => {
    renderMap();
    const keystone = MOUNTAINS.find((m) => m.id === 'keystone')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${keystone.name}\. Tap to view`, 'i') }));

    await waitFor(() => expect(screen.getByText('Base')).toBeInTheDocument(), { timeout: 12_000 });
    expect(screen.getByText('Peak')).toBeInTheDocument();
    expect(screen.getAllByText(/out of 10/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: /the snow clock/i })).toBeInTheDocument();
    expect(screen.getByText('Parking')).toBeInTheDocument();
  });

  it('in real live mode, resolves the quick route preview with exactly one network call — never the whole day-curve grid', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'live');
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.test');
    const fetchSpy = vi.fn(
      async (url: string, _init?: RequestInit) => {
        if (url === 'https://proxy.example.test/api/route-preview') {
          return new Response(JSON.stringify({ durationMinutes: 121, distanceMiles: 99.4 }), { status: 200 });
        }
        return new Response(JSON.stringify({ samples: [{ departure: 360, durationMinutes: 121, congestion: 0.2 }] }), {
          status: 200,
        });
      },
    );
    vi.stubGlobal('fetch', fetchSpy);

    const liveRegistry = createLiveRegistry({ trafficApiBaseUrl: 'https://proxy.example.test' });
    renderMap({ registry: liveRegistry, usingDemoData: false });
    const vail = MOUNTAINS.find((m) => m.id === 'vail')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${vail.name}\. Tap to view`, 'i') }));

    await waitFor(() => expect(screen.getByText('2h01')).toBeInTheDocument());
    expect(screen.getByText('99 mi')).toBeInTheDocument();
    expect(screen.getByText('Traffic-aware')).toBeInTheDocument();
    expect(fetchSpy.mock.calls.filter((call) => call[0] === 'https://proxy.example.test/api/route-preview')).toHaveLength(1);
  });

  it('requests the live route preview against the routing destination, not the map-pin coordinate, and offers Navigate links to it', async () => {
    vi.stubEnv('VITE_DATA_MODE', 'live');
    vi.stubEnv('VITE_API_BASE_URL', 'https://proxy.example.test');
    const fetchSpy = vi.fn(async (url: string, _init?: RequestInit) => {
      if (url === 'https://proxy.example.test/api/route-preview') {
        return new Response(JSON.stringify({ durationMinutes: 200, distanceMiles: 160, polyline: null }), {
          status: 200,
        });
      }
      return new Response('{}', { status: 200 });
    });
    vi.stubGlobal('fetch', fetchSpy);

    const liveRegistry = createLiveRegistry({ trafficApiBaseUrl: 'https://proxy.example.test' });
    const steamboat = MOUNTAINS.find((m) => m.id === 'steamboat')!;
    renderMap({ registry: liveRegistry, usingDemoData: false, origin: gpsOrigin(40.0, -105.3) });
    await user().click(screen.getByRole('button', { name: new RegExp(`^${steamboat.name}\. Tap to view`, 'i') }));

    await waitFor(() => expect(screen.getByText('3h20')).toBeInTheDocument());

    const [, init] = fetchSpy.mock.calls.find((call) => call[0] === 'https://proxy.example.test/api/route-preview')!;
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body.destination).toEqual({ lat: steamboat.routingDestination!.lat, lon: steamboat.routingDestination!.lon });

    const googleLink = screen.getByRole('link', { name: /navigate to .* in google maps/i });
    expect(googleLink.getAttribute('href')).toContain(
      `destination=${steamboat.routingDestination!.lat}%2C${steamboat.routingDestination!.lon}`,
    );
    expect(googleLink.getAttribute('href')).toContain('origin=40%2C-105.3');
  });

  it('works the same way for a GPS origin as for a manual city', async () => {
    const origin = gpsOrigin(39.7, -105.2);
    renderMap({ origin });
    const breck = MOUNTAINS.find((m) => m.id === 'breckenridge')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${breck.name}\. Tap to view`, 'i') }));
    await waitFor(() => expect(screen.getByText('Drive time')).toBeInTheDocument());
    expect(screen.getAllByText(/^you$/i).length).toBeGreaterThan(0);
  });

  it('never fabricates a time or distance when routing fails — it says so honestly, without leaking a raw provider error', async () => {
    const failingRegistry: ProviderRegistry = {
      ...createDemoRegistry(),
      traffic: {
        id: 'failing-traffic',
        getTravelCurve: async () => unavailable('failing-traffic', '502 Bad Gateway'),
      },
    };

    renderMap({ registry: failingRegistry });
    const keystone = MOUNTAINS.find((m) => m.id === 'keystone')!;
    await user().click(screen.getByRole('button', { name: new RegExp(`^${keystone.name}\. Tap to view`, 'i') }));

    await waitFor(() => expect(screen.getByText(/Couldn't get a route/i)).toBeInTheDocument());
    // The failure is explained in plain language — never the raw provider
    // reason (which could be a bare HTTP status code like "502").
    expect(screen.queryByText(/502/)).not.toBeInTheDocument();
    expect(screen.queryByText('Drive time')).not.toBeInTheDocument();
  });

  it('lets you close a profile and return to the map, then open a different mountain', async () => {
    renderMap();
    const vail = MOUNTAINS.find((m) => m.id === 'vail')!;
    const breck = MOUNTAINS.find((m) => m.id === 'breckenridge')!;

    await user().click(screen.getByRole('button', { name: new RegExp(`^${vail.name}\. Tap to view`, 'i') }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: new RegExp(`^${vail.name}`) })).toBeInTheDocument(),
    );

    await user().click(screen.getByRole('button', { name: /map/i }));
    expect(screen.queryByRole('heading', { name: new RegExp(`^${vail.name}`) })).not.toBeInTheDocument();

    await user().click(screen.getByRole('button', { name: new RegExp(`^${breck.name}\. Tap to view`, 'i') }));
    await waitFor(() =>
      expect(screen.getByRole('heading', { name: new RegExp(`^${breck.name}`) })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('heading', { name: new RegExp(`^${vail.name}`) })).not.toBeInTheDocument();
  });
});
