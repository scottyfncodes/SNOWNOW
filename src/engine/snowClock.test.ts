import { describe, expect, it } from 'vitest';
import { at } from '@/domain/time';
import {
  testInputs,
  testMountain,
  testOperations,
  testWeather,
} from '@/test/fixtures';
import {
  buildSnowClock,
  createQualityIntegral,
  findPrimeWindow,
  qualityAt,
  qualityMinutesBetween,
  untrackedAt,
  weatherAt,
} from './snowClock';

describe('snow clock — fresh snow as a consumable', () => {
  it('starts the day with the overnight total untracked', () => {
    const clock = buildSnowClock(testInputs({ weather: testWeather({ overnightSnowIn: 8 }) }));
    expect(untrackedAt(clock, clock.open)).toBeCloseTo(8, 1);
  });

  it('keeps stacking while it is still snowing', () => {
    const clock = buildSnowClock(
      testInputs({
        weather: testWeather({ overnightSnowIn: 4, daytimeRateInPerHour: 1, snowUntil: at(9) }),
      }),
    );
    // This early, close to opening, track-out is still minimal — an inch an hour keeps falling.
    expect(untrackedAt(clock, at(9))).toBeGreaterThan(4);
  });

  it('spreads the same traffic further when more terrain is open', () => {
    const narrow = buildSnowClock(
      testInputs({
        weather: testWeather({ overnightSnowIn: 10 }),
        operations: testOperations({ terrainOpenShare: 0.35 }),
      }),
    );
    const wide = buildSnowClock(
      testInputs({
        weather: testWeather({ overnightSnowIn: 10 }),
        operations: testOperations({ terrainOpenShare: 0.95 }),
      }),
    );
    expect(untrackedAt(wide, at(12))).toBeGreaterThan(untrackedAt(narrow, at(12)));
  });
});

describe('snow clock — quality', () => {
  it('marks hours outside operating times as closed', () => {
    const clock = buildSnowClock(testInputs());
    expect(clock.points.find((p) => p.minute === at(7))?.closed).toBe(true);
    expect(clock.points.find((p) => p.minute === at(10))?.closed).toBe(false);
    expect(clock.points.find((p) => p.minute === at(7))?.label).toBe('Building');
  });

  it('rates a powder day above a warm slush day', () => {
    const powder = buildSnowClock(
      testInputs({ weather: testWeather({ overnightSnowIn: 12, temperatureF: 15 }) }),
    );
    const slush = buildSnowClock(
      testInputs({ weather: testWeather({ overnightSnowIn: 0, temperatureF: 44 }) }),
    );
    expect(qualityAt(powder, at(10))).toBeGreaterThan(qualityAt(slush, at(10)));
  });

  it('penalises severe wind', () => {
    const calm = buildSnowClock(testInputs({ weather: testWeather({ windMph: 4 }) }));
    const gale = buildSnowClock(testInputs({ weather: testWeather({ windMph: 45 }) }));
    expect(qualityAt(gale, at(11))).toBeLessThan(qualityAt(calm, at(11)));
  });

  it('holds the good terrain back until avalanche control finishes', () => {
    const inputs = testInputs({
      mountain: testMountain({
        terrain: { trails: 100, acres: 2000, aboveTreelineShare: 0.8, lateOpeningShare: 0.2 },
      }),
      weather: testWeather({ overnightSnowIn: 10 }),
      operations: testOperations({ upperMountainDelayMinutes: 120 }),
    });
    const clock = buildSnowClock(inputs);
    const before = clock.points.find((p) => p.minute === at(9))!;
    const after = clock.points.find((p) => p.minute === at(11))!;
    expect(before.factors.access).toBeLessThan(after.factors.access);
  });

  it('drops quality when the mountain opens late', () => {
    const clock = buildSnowClock(
      testInputs({ operations: testOperations({ expectedOpen: at(10, 30) }) }),
    );
    expect(clock.open).toBe(at(10, 30));
    expect(clock.points.find((p) => p.minute === at(9))?.closed).toBe(true);
  });

  it('degrades through the day as the powder gets skied off', () => {
    const clock = buildSnowClock(testInputs({ weather: testWeather({ overnightSnowIn: 12 }) }));
    expect(qualityAt(clock, at(9))).toBeGreaterThan(qualityAt(clock, at(15)));
  });
});

describe('prime window', () => {
  it('lands in the morning on a powder day', () => {
    const clock = buildSnowClock(testInputs({ weather: testWeather({ overnightSnowIn: 11 }) }));
    expect(clock.prime).not.toBeNull();
    expect(clock.prime!.start).toBeGreaterThanOrEqual(clock.open);
    expect(clock.prime!.peakMinute).toBeLessThan(at(12));
    expect(clock.prime!.end).toBeLessThanOrEqual(clock.close + 15);
  });

  it('still names a window on a mediocre day rather than reporting nothing', () => {
    const clock = buildSnowClock(
      testInputs({
        weather: testWeather({ overnightSnowIn: 0, temperatureF: 42, windMph: 30 }),
      }),
    );
    expect(clock.prime).not.toBeNull();
  });

  it('returns nothing when the mountain never opens', () => {
    expect(findPrimeWindow([])).toBeNull();
  });
});

describe('quality integral', () => {
  it('agrees with the direct sum', () => {
    const clock = buildSnowClock(testInputs({ weather: testWeather({ overnightSnowIn: 6 }) }));
    const integral = createQualityIntegral(clock);
    const direct = qualityMinutesBetween(clock, at(9), at(14));
    expect(integral(at(9), at(14))).toBeCloseTo(direct, 0);
  });

  it('counts nothing outside operating hours', () => {
    const clock = buildSnowClock(testInputs());
    expect(qualityMinutesBetween(clock, at(6), at(7))).toBe(0);
    expect(qualityMinutesBetween(clock, at(14), at(13))).toBe(0);
  });
});

describe('weather interpolation', () => {
  it('interpolates between hourly samples', () => {
    const hourly = testWeather({ temperatureF: 20 }).hourly;
    expect(weatherAt(hourly, at(10, 30))?.temperatureF).toBeCloseTo(20, 5);
    expect(weatherAt([], at(10))).toBeNull();
  });
});

describe('missing data', () => {
  it('still produces a clock when every feed is down', () => {
    const clock = buildSnowClock(testInputs({ weather: 'unavailable', operations: 'unavailable' }));
    expect(clock.points.length).toBeGreaterThan(10);
    expect(clock.points.every((p) => Number.isFinite(p.quality))).toBe(true);
  });
});
