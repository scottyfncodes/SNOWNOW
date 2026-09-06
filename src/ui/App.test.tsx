import { describe, expect, it } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from '@/App';
import { createDemoRegistry } from '@/providers/demo';

/**
 * These tests walk the product's actual promise: open it, tap NOW, get an
 * answer you can act on — and tap LATER, pick a date, get a projection that is
 * honest about being one.
 */

const user = () => userEvent.setup();

async function tapNow() {
  render(<App />);
  await user().click(screen.getByRole('button', { name: /^NOW/ }));
  return waitFor(() => expect(screen.getByText(/The call/i)).toBeInTheDocument(), {
    timeout: 12_000,
  });
}

describe('the homepage', () => {
  it('offers exactly two choices and no dashboard', () => {
    render(<App />);
    expect(screen.getByText('Find your best mountain day.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^NOW/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^LATER/ })).toBeInTheDocument();
    expect(screen.queryByText(/Snow Clock/i)).not.toBeInTheDocument();
  });

  it('says plainly that it is running on demo data', () => {
    render(<App />);
    expect(screen.getByText('DEMO DATA')).toBeInTheDocument();
    expect(screen.getByText(/No live weather, traffic or lift feeds/i)).toBeInTheDocument();
  });

  it('lets you change where you are starting from without typing', async () => {
    render(<App />);
    const select = screen.getByLabelText(/starting from/i);
    await user().selectOptions(select, 'boulder');
    expect((select as HTMLSelectElement).value).toBe('boulder');
  });
});

describe('NOW', () => {
  it('shows a loading sequence that says what it is checking', () => {
    render(<App />);
    // Synchronous click: the answer cannot possibly have arrived yet, so this
    // pins the loading state deterministically rather than racing it.
    fireEvent.click(screen.getByRole('button', { name: /^NOW/ }));
    expect(screen.getAllByText(/CHECKING THE/i).length).toBeGreaterThan(0);
    expect(screen.getByRole('status')).toHaveTextContent(/checking the mountain/i);
  });

  it('answers with a mountain, a score and a verdict', async () => {
    await tapNow();
    const card = screen.getByRole('heading', { level: 1 });
    expect(card.textContent).toBeTruthy();
    expect(screen.getAllByText(/out of 10/i).length).toBeGreaterThan(0);
  });

  it('answers all six questions the product exists to answer', async () => {
    await tapNow();
    expect(screen.getAllByText(/^Leave /).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Arrive').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Prime snow').length).toBeGreaterThan(0);
    expect(screen.getByText('Head home')).toBeInTheDocument();
    expect(screen.getByText('Home by')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /why that one/i })).toBeInTheDocument();
  });

  it('never claims demo numbers are live', async () => {
    await tapNow();
    expect(screen.getAllByText('DEMO DATA').length).toBeGreaterThan(0);
    expect(screen.queryByText(/^LIVE$/)).not.toBeInTheDocument();
  });

  it('renders the snow clock, the timeline and both timing panels', async () => {
    await tapNow();
    expect(screen.getByRole('heading', { name: /the snow clock/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /your day/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /when to leave/i })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /when to head home/i })).toBeInTheDocument();
  });

  it('lets you ask what if I leave later, and answers with consequences', async () => {
    await tapNow();
    const slider = screen.getByRole('slider', { name: /departure time/i }) as HTMLInputElement;
    const before = slider.getAttribute('aria-valuetext');
    fireEvent.change(slider, { target: { value: String(Number(slider.max)) } });
    await waitFor(() => expect(slider.getAttribute('aria-valuetext')).not.toBe(before));
    // Leaving at the very end of the grid must cost you something real.
    expect(screen.getByRole('button', { name: /back to the sweet spot/i })).toBeInTheDocument();
    const panel = screen.getByRole('heading', { name: /when to leave/i }).closest('section')!;
    expect(
      within(panel).getByText(/costs you|worth the alarm|a little later/i),
    ).toBeInTheDocument();
  });

  it('lets you compare alternatives and switch to one', async () => {
    await tapNow();
    const alternatives = screen.getByRole('heading', { name: /why that one/i }).closest('section')!;
    const first = within(alternatives).getAllByRole('button')[0]!;
    const name = first.querySelector('.alt-name')!.textContent!;
    expect(screen.getByRole('heading', { level: 1 }).textContent).not.toBe(name);
    await user().click(first);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(name));
  });

  it('can take the score apart on request', async () => {
    await tapNow();
    const disclosure = screen.getByRole('button', { name: /how we got/i });
    expect(disclosure).toHaveAttribute('aria-expanded', 'false');
    await user().click(disclosure);
    expect(disclosure).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText(/decision support/i)).toBeInTheDocument();
  });

  it('goes back to the two choices', async () => {
    await tapNow();
    await user().click(screen.getByRole('button', { name: /back to start/i }));
    expect(screen.getByRole('button', { name: /^LATER/ })).toBeInTheDocument();
  });
});

describe('LATER', () => {
  it('projects a specific future date and marks it as a projection', async () => {
    render(<App />);
    await user().click(screen.getByRole('button', { name: /^LATER/ }));
    await waitFor(() => expect(screen.getByText(/Projected best/i)).toBeInTheDocument(), {
      timeout: 12_000,
    });
    expect(screen.getByText(/CONFIDENCE/)).toBeInTheDocument();
    expect(screen.getByText('FORECAST')).toBeInTheDocument();
  });

  it('ranks a whole range and names a best bet with its confidence', async () => {
    render(<App />);
    await user().click(screen.getByRole('button', { name: /^LATER/ }));
    await waitFor(() => expect(screen.getByText(/Projected best/i)).toBeInTheDocument(), {
      timeout: 12_000,
    });
    await user().click(screen.getByRole('button', { name: /next 7 days/i }));
    await waitFor(() => expect(screen.getByText(/Best bet/i)).toBeInTheDocument(), {
      timeout: 20_000,
    });
    const table = screen.getByRole('table', { name: /projected best mountain by day/i });
    expect(within(table).getAllByRole('row').length).toBeGreaterThan(5);
    expect(screen.getByText(/leans harder on pattern and history/i)).toBeInTheDocument();
  });
});

describe('accessibility basics', () => {
  it('exposes the recommendation as text for screen readers', async () => {
    await tapNow();
    const status = screen.getAllByRole('status')[0]!;
    expect(status.textContent).toMatch(/out of 10/i);
    expect(status.textContent).toMatch(/Leave /);
  });

  it('describes the charts rather than leaving them as bare SVG', async () => {
    await tapNow();
    expect(screen.getByRole('img', { name: /ski quality through the day/i })).toBeInTheDocument();
    expect(screen.getAllByRole('img', { name: /drive/i }).length).toBeGreaterThan(0);
  });

  it('gives every score bar a meter role with a value', async () => {
    await tapNow();
    await user().click(screen.getByRole('button', { name: /how we got/i }));
    const meters = screen.getAllByRole('meter');
    expect(meters.length).toBe(11);
    for (const meter of meters) {
      expect(meter).toHaveAttribute('aria-valuenow');
      expect(meter).toHaveAttribute('aria-label');
    }
  });

  it('does not rely on colour alone for traffic status', async () => {
    await tapNow();
    const table = screen.getByRole('table', { name: /stay or go/i });
    expect(within(table).getAllByText(/flowing|slow|jammed/i).length).toBeGreaterThan(0);
  });
});

describe('honest empty states', () => {
  async function tapNowWith(registry: ReturnType<typeof createDemoRegistry>) {
    render(<App registry={registry} />);
    await user().click(screen.getByRole('button', { name: /^NOW/ }));
    await waitFor(() => expect(screen.getByText(/The call/i)).toBeInTheDocument(), {
      timeout: 12_000,
    });
  }

  it('says the weather feed is down instead of inventing snow', async () => {
    await tapNowWith(createDemoRegistry({ weather: { failFor: () => true } }));
    expect(screen.getByText(/Weather's being weird/i)).toBeInTheDocument();
  });

  it('refuses to fake the drive when road data is missing', async () => {
    await tapNowWith(createDemoRegistry({ traffic: { failFor: () => true } }));
    expect(screen.getByText(/we're not going to fake the drive/i)).toBeInTheDocument();
    expect(screen.getByText(/can't time this day/i)).toBeInTheDocument();
    expect(screen.queryByText('Head home')).not.toBeInTheDocument();
  });

  it('lowers confidence when the lift report is silent', async () => {
    await tapNowWith(createDemoRegistry({ mountain: { failOperationsFor: () => true } }));
    expect(screen.getByText(/Lift report isn't talking/i)).toBeInTheDocument();
    expect(screen.getByText(/MEDIUM CONFIDENCE|LOW CONFIDENCE/)).toBeInTheDocument();
  });
});
