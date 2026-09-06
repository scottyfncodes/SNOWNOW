import { describe, expect, it } from 'vitest';
import { at } from '@/domain/time';
import { testTravel } from '@/test/fixtures';
import { bestCurve, fastestSample, slowestSample, trafficLightFor, travelAt } from './travel';

const curve = testTravel({
  direction: 'outbound',
  duration: (departure) => (departure < at(6) ? 90 : 150),
  from: at(5),
  to: at(8),
  step: 60,
});

describe('travelAt', () => {
  it('reads a sampled point exactly', () => {
    expect(travelAt(curve, at(5)).durationMinutes).toBe(90);
    expect(travelAt(curve, at(7)).durationMinutes).toBe(150);
  });

  it('interpolates between samples rather than snapping', () => {
    const mid = travelAt(curve, at(5, 30));
    expect(mid.durationMinutes).toBeGreaterThan(90);
    expect(mid.durationMinutes).toBeLessThan(150);
    expect(mid.extrapolated).toBe(false);
  });

  it('clamps outside the sampled window and says so', () => {
    expect(travelAt(curve, at(2)).extrapolated).toBe(true);
    expect(travelAt(curve, at(2)).durationMinutes).toBe(90);
    expect(travelAt(curve, at(23)).extrapolated).toBe(true);
  });

  it('returns nothing useful for an empty curve', () => {
    const empty = { ...curve, samples: [] };
    expect(travelAt(empty, at(6))).toEqual({ durationMinutes: 0, congestion: 0, extrapolated: true });
  });
});

describe('curve selection', () => {
  it('finds the fastest and slowest samples', () => {
    expect(fastestSample(curve)!.durationMinutes).toBe(90);
    expect(slowestSample(curve)!.durationMinutes).toBe(150);
  });

  it('picks the route with the best achievable time', () => {
    const slow = testTravel({ direction: 'outbound', duration: () => 200 });
    const fast = testTravel({ direction: 'outbound', duration: () => 80 });
    expect(bestCurve([slow, fast])).toBe(fast);
    expect(bestCurve([])).toBeNull();
  });
});

describe('traffic lights', () => {
  it('maps congestion onto three states', () => {
    expect(trafficLightFor(0.1)).toBe('green');
    expect(trafficLightFor(0.45)).toBe('yellow');
    expect(trafficLightFor(0.9)).toBe('red');
  });
});
