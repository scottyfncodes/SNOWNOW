import { describe, expect, it } from 'vitest';
import { MOUNTAINS } from '@/data/mountains';
import { findOrigin } from '@/data/origins';
import { addDays, dateRange } from '@/domain/dates';
import { at } from '@/domain/time';
import { createDemoRegistry } from '@/providers/demo';
import { projectRange } from './future';

const TODAY = '2026-01-14';
const origin = findOrigin('denver');
const registry = createDemoRegistry();

const project = (dates: string[]) =>
  projectRange(registry, { mountains: MOUNTAINS, origin, dates, today: TODAY, now: at(6, 0) });

describe('LATER — future date planning', () => {
  it('projects a single future date', async () => {
    const result = await project([addDays(TODAY, 3)]);
    expect(result.days.length).toBe(1);
    expect(result.days[0]!.horizonDays).toBe(3);
    expect(result.days[0]!.recommendation.best.isToday).toBe(false);
  });

  it('projects a whole range and names a best bet', async () => {
    const result = await project(dateRange(addDays(TODAY, 1), 7));
    expect(result.days.length).toBe(7);
    expect(result.bestBet).not.toBeNull();
    expect(result.days.map((day) => day.date)).toEqual([...result.days.map((d) => d.date)].sort());
  });

  it('labels near dates as forecast and far dates as projected', async () => {
    const near = await project([addDays(TODAY, 1)]);
    const far = await project([addDays(TODAY, 12)]);
    expect(near.days[0]!.recommendation.best.provenance.observation).toBe('forecast');
    expect(far.days[0]!.recommendation.best.provenance.observation).toBe('projected');
  });

  it('degrades confidence with lead time', async () => {
    const result = await project([addDays(TODAY, 1), addDays(TODAY, 5), addDays(TODAY, 12)]);
    expect(result.days[0]!.confidence).toBe('high');
    expect(result.days[1]!.confidence).toBe('medium');
    expect(result.days[2]!.confidence).toBe('low');
  });

  it('discounts uncertain days when choosing the best bet', async () => {
    const result = await project([addDays(TODAY, 1), addDays(TODAY, 12)]);
    for (const day of result.days) {
      const expectedDiscount = { high: 0, medium: 0.15, low: 0.45 }[day.confidence];
      expect(day.adjustedScore).toBeCloseTo(
        day.recommendation.best.score.score - expectedDiscount,
        2,
      );
    }
    expect(result.bestBet!.adjustedScore).toBe(
      Math.max(...result.days.map((day) => day.adjustedScore)),
    );
  });

  it('does not let a shaky long-range score beat a solid near one', async () => {
    const result = await project(dateRange(addDays(TODAY, 1), 14));
    const bet = result.bestBet!;
    for (const day of result.days) {
      expect(day.adjustedScore).toBeLessThanOrEqual(bet.adjustedScore);
    }
  });

  it('is stable across runs', async () => {
    const dates = dateRange(addDays(TODAY, 1), 4);
    const [a, b] = await Promise.all([project(dates), project(dates)]);
    expect(a.days.map((d) => d.recommendation.best.mountain.id)).toEqual(
      b.days.map((d) => d.recommendation.best.mountain.id),
    );
    expect(a.bestBet!.date).toBe(b.bestBet!.date);
  });

  it('handles an empty range without falling over', async () => {
    const result = await project([]);
    expect(result.days).toEqual([]);
    expect(result.bestBet).toBeNull();
  });
});
