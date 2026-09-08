import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { buildPlan } from '@/engine/plan';
import { testInputs, testOperations, testWeather } from '@/test/fixtures';
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
  });
});
