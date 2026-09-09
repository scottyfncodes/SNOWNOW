import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { estimatedRangeFor } from '@/data/pricing';
import { formatPrice } from '@/domain/pricing';
import { buildPlan } from '@/engine/plan';
import { testInputs, testMountain, testOperations, testWeather } from '@/test/fixtures';
import { RecommendationCard } from './RecommendationCard';

describe('RecommendationCard — base/peak and snow timeline', () => {
  it('shows base and peak temperature, wind and depth on the front page, with peak marked unavailable rather than copied from base', () => {
    const plan = buildPlan(
      testInputs({
        weather: testWeather({
          temperatureF: 22,
          windMph: 6,
          baseSnowDepthIn: 55,
          peakUnavailable: true,
        }),
      }),
    );
    render(<RecommendationCard plan={plan} />);

    expect(screen.getByText('Base')).toBeInTheDocument();
    expect(screen.getByText('Peak')).toBeInTheDocument();
    expect(screen.getByText('22°F')).toBeInTheDocument();
    expect(screen.getByText('55" depth')).toBeInTheDocument();
    // Peak is null on this fixture — it must read as unavailable, not a copy of base.
    expect(screen.getByText('Unavailable')).toBeInTheDocument();
  });

  it('renders the 5-day snow timeline with distinct observed and forecast totals', () => {
    const plan = buildPlan(
      testInputs({ weather: testWeather({ past5TotalIn: 14, future5TotalIn: 8 }) }),
    );
    render(<RecommendationCard plan={plan} />);

    expect(screen.getByText('14.0″')).toBeInTheDocument();
    expect(screen.getByText('8.0″')).toBeInTheDocument();
    expect(screen.getByText('OBSERVED')).toBeInTheDocument();
    expect(screen.getAllByText('FORECAST').length).toBeGreaterThan(0);
  });

  it('replaces the normal verdict and timing with an off-season message when the mountain is closed, shown exactly once', () => {
    const plan = buildPlan(testInputs({ operations: testOperations({ status: 'closed' }) }));
    render(<RecommendationCard plan={plan} />);

    expect(screen.getByRole('status')).toBeInTheDocument();
    // The line and detail each appear exactly once — no duplicate box repeating them lower on the card.
    expect(screen.getAllByText(plan.offSeasonMessage!.line).length).toBe(1);
    expect(screen.getAllByText(plan.offSeasonMessage!.detail).length).toBe(1);
    expect(screen.queryByText('Head home')).not.toBeInTheDocument();
    expect(screen.queryByText('Prime snow')).not.toBeInTheDocument();
    // Base/peak and the snow cycle are still shown — the point is an honest
    // "not today", not a blank screen.
    expect(screen.getByText('Base')).toBeInTheDocument();
    // Ticket price isn't tied to "today" the way departure timing is — it
    // should still show even while the mountain is closed for the season.
    expect(screen.getByText('Lift ticket')).toBeInTheDocument();
  });
});

describe('RecommendationCard — Epic Pass badge', () => {
  it('shows the badge in the top-right corner for a mountain on the Epic Pass', () => {
    const plan = buildPlan(testInputs({ mountain: testMountain({ passAffiliations: ['epic'] }) }));
    render(<RecommendationCard plan={plan} />);
    expect(screen.getByText('Epic Pass')).toBeInTheDocument();
  });

  it('still shows the badge off-season, when the day-score dial is not rendered', () => {
    const plan = buildPlan(
      testInputs({
        mountain: testMountain({ passAffiliations: ['epic'] }),
        operations: testOperations({ status: 'closed' }),
      }),
    );
    render(<RecommendationCard plan={plan} />);
    expect(screen.getByText('Epic Pass')).toBeInTheDocument();
  });

  it('shows no badge for a mountain on a different pass', () => {
    const plan = buildPlan(testInputs({ mountain: testMountain({ passAffiliations: ['ikon'] }) }));
    render(<RecommendationCard plan={plan} />);
    expect(screen.queryByText('Epic Pass')).not.toBeInTheDocument();
  });
});

describe('RecommendationCard — ticket price', () => {
  it('shows a ballpark range, clearly not a live quote, when no live price is available', () => {
    const mountain = testMountain({ id: 'vail', name: 'Vail' });
    const plan = buildPlan(testInputs({ mountain, ticket: 'unavailable' }));
    render(<RecommendationCard plan={plan} />);

    const range = estimatedRangeFor('vail');
    expect(
      screen.getByText(`${formatPrice(range.low, range.currency)}–${formatPrice(range.high, range.currency)}`),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ballpark estimate, not a live quote/)).toBeInTheDocument();
    expect(screen.queryByText(/Current price unavailable/)).not.toBeInTheDocument();
  });
});
