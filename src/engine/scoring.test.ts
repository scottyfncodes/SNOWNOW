import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES, DEFAULT_WEIGHTS } from '@/config/weights';
import { at } from '@/domain/time';
import {
  testCrowds,
  testInputs,
  testOperations,
  testTicket,
  testTravel,
  testWeather,
} from '@/test/fixtures';
import { optimizeDay } from './optimize';
import { scoreDay } from './scoring';
import { buildSnowClock } from './snowClock';
import type { DayInputs } from './inputs';

const prefs = DEFAULT_PREFERENCES;

function scoreFor(inputs: DayInputs) {
  const clock = buildSnowClock(inputs);
  const optimized = optimizeDay(inputs, clock, { preferences: prefs });
  return {
    clock,
    optimized,
    score: scoreDay({
      inputs,
      clock,
      departure: optimized.departure,
      ret: optimized.ret,
      preferences: prefs,
    }),
  };
}

const factor = (score: ReturnType<typeof scoreDay>, key: string) =>
  score.factors.find((f) => f.key === key)!;

describe('score shape', () => {
  it('stays inside 0..10 with one decimal', () => {
    const { score } = scoreFor(testInputs({ weather: testWeather({ overnightSnowIn: 14 }) }));
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThanOrEqual(10);
    expect(Number(score.score.toFixed(1))).toBe(score.score);
  });

  it('reports every configured factor exactly once', () => {
    const { score } = scoreFor(testInputs());
    const keys = score.factors.map((f) => f.key);
    expect(new Set(keys).size).toBe(keys.length);
    expect(keys.sort()).toEqual(Object.keys(DEFAULT_WEIGHTS.factors).sort());
  });
});

describe('factor interactions', () => {
  it('scores deep snow above no snow, all else equal', () => {
    const deep = scoreFor(testInputs({ weather: testWeather({ overnightSnowIn: 14 }) })).score;
    const dry = scoreFor(
      testInputs({ weather: testWeather({ overnightSnowIn: 0, daysSinceStorm: 9 }) }),
    ).score;
    expect(deep.score).toBeGreaterThan(dry.score);
    expect(factor(deep, 'snow').value).toBeGreaterThan(factor(dry, 'snow').value);
  });

  it('punishes a long drive even when the snow is identical', () => {
    const near = scoreFor(
      testInputs({
        outbound: testTravel({ direction: 'outbound', duration: () => 70 }),
        inbound: testTravel({ direction: 'return', duration: () => 70 }),
        weather: testWeather({ overnightSnowIn: 10 }),
      }),
    ).score;
    const far = scoreFor(
      testInputs({
        outbound: testTravel({ direction: 'outbound', duration: () => 230 }),
        inbound: testTravel({ direction: 'return', duration: () => 230 }),
        weather: testWeather({ overnightSnowIn: 10 }),
      }),
    ).score;
    expect(factor(near, 'travel').value).toBeGreaterThan(factor(far, 'travel').value);
    expect(near.score).toBeGreaterThan(far.score);
  });

  it('marks closed roads down hard', () => {
    const clear = scoreFor(
      testInputs({ outbound: testTravel({ direction: 'outbound', duration: () => 100 }) }),
    ).score;
    const chains = scoreFor(
      testInputs({
        outbound: testTravel({
          direction: 'outbound',
          duration: () => 100,
          roadCondition: 'chains-required',
        }),
      }),
    ).score;
    expect(factor(chains, 'roads').value).toBeLessThan(factor(clear, 'roads').value);
  });

  it('reflects terrain and lift availability', () => {
    const open = scoreFor(
      testInputs({ operations: testOperations({ terrainOpenShare: 0.98, liftsExpectedOpen: 20 }) }),
    ).score;
    const shut = scoreFor(
      testInputs({ operations: testOperations({ terrainOpenShare: 0.3, liftsExpectedOpen: 5 }) }),
    ).score;
    expect(factor(open, 'terrain').value).toBeGreaterThan(factor(shut, 'terrain').value);
    expect(factor(open, 'operations').value).toBeGreaterThan(factor(shut, 'operations').value);
  });

  it('notices crowds', () => {
    const quiet = scoreFor(testInputs({ crowds: testCrowds(0.05) })).score;
    const packed = scoreFor(testInputs({ crowds: testCrowds(0.95) })).score;
    expect(factor(quiet, 'crowds').value).toBeGreaterThan(factor(packed, 'crowds').value);
  });
});

describe('weight configuration', () => {
  it('changes the answer when the weights change', () => {
    const inputs = testInputs({
      weather: testWeather({ overnightSnowIn: 12 }),
      outbound: testTravel({ direction: 'outbound', duration: () => 220 }),
      inbound: testTravel({ direction: 'return', duration: () => 220 }),
    });
    const clock = buildSnowClock(inputs);
    const optimized = optimizeDay(inputs, clock, { preferences: prefs });
    const base = scoreDay({ inputs, clock, departure: optimized.departure, ret: optimized.ret, preferences: prefs });

    const travelObsessed = scoreDay({
      inputs,
      clock,
      departure: optimized.departure,
      ret: optimized.ret,
      preferences: prefs,
      weights: {
        ...DEFAULT_WEIGHTS,
        factors: { ...DEFAULT_WEIGHTS.factors, travel: 8 },
      },
    });
    expect(travelObsessed.score).toBeLessThan(base.score);
  });
});

describe('missing data', () => {
  it('imputes a neutral value and says so', () => {
    const { score } = scoreFor(testInputs({ weather: 'unavailable' }));
    expect(factor(score, 'snow').imputed).toBe(true);
    expect(factor(score, 'snow').note).toMatch(/no snow report/i);
  });

  it('drops confidence when several feeds are missing', () => {
    const full = scoreFor(testInputs()).score;
    const partial = scoreFor(
      testInputs({ weather: 'unavailable', operations: 'unavailable', crowds: 'unavailable' }),
    ).score;
    expect(full.confidence).toBe('high');
    expect(partial.confidence).toBe('low');
  });

  it('imputes timing factors when there is no route at all', () => {
    const { score, optimized } = scoreFor(testInputs({ outbound: 'unavailable' }));
    expect(optimized.departure).toBeNull();
    expect(factor(score, 'travel').imputed).toBe(true);
    expect(factor(score, 'usableTime').imputed).toBe(true);
  });
});

describe('penalties', () => {
  it('docks the score for getting home far too late, and names it', () => {
    const inputs = testInputs({
      weather: testWeather({ overnightSnowIn: 8 }),
      inbound: testTravel({ direction: 'return', duration: () => 100 }),
    });
    const clock = buildSnowClock(inputs);
    const optimized = optimizeDay(inputs, clock, { preferences: prefs });

    const late = scoreDay({
      inputs,
      clock,
      departure: optimized.departure,
      ret: { ...optimized.ret!, homeArrival: at(22, 30) },
      preferences: prefs,
    });
    expect(late.penalties.length).toBe(1);
    expect(late.penalties[0]!.label).toMatch(/later than you wanted/);
    expect(late.raw).toBeLessThan(
      scoreDay({ inputs, clock, departure: optimized.departure, ret: optimized.ret, preferences: prefs }).raw,
    );
  });
});

describe('extremes', () => {
  it('survives a day where everything is bad', () => {
    const { score } = scoreFor(
      testInputs({
        weather: testWeather({ overnightSnowIn: 0, temperatureF: 48, windMph: 60, visibility: 0.1, daysSinceStorm: 20 }),
        operations: testOperations({ terrainOpenShare: 0.25, liftsExpectedOpen: 3, windHoldRisk: 0.9 }),
        crowds: testCrowds(1),
        outbound: testTravel({ direction: 'outbound', duration: () => 280, roadCondition: 'chains-required', congestion: () => 0.95 }),
        inbound: testTravel({ direction: 'return', duration: () => 280, roadCondition: 'chains-required', congestion: () => 0.95 }),
      }),
    );
    expect(score.score).toBeGreaterThanOrEqual(0);
    expect(score.score).toBeLessThan(5);
    expect(score.weaknesses.length).toBeGreaterThan(0);
  });

  it('rewards a day where everything is good', () => {
    const { score } = scoreFor(
      testInputs({
        weather: testWeather({ overnightSnowIn: 13, temperatureF: 18, windMph: 4, visibility: 1 }),
        operations: testOperations({ terrainOpenShare: 0.99, liftsExpectedOpen: 20, windHoldRisk: 0 }),
        crowds: testCrowds(0.1),
        outbound: testTravel({ direction: 'outbound', duration: () => 62, congestion: () => 0.02 }),
        inbound: testTravel({ direction: 'return', duration: () => 62, congestion: () => 0.02 }),
      }),
    );
    expect(score.score).toBeGreaterThan(8.5);
    expect(score.strengths.length).toBeGreaterThan(0);
  });
});

describe('ticket price', () => {
  it('scores a cheap ticket above an expensive one', () => {
    const cheap = scoreFor(testInputs({ ticket: testTicket(99, 139) })).score;
    const dear = scoreFor(testInputs({ ticket: testTicket(289, 289) })).score;
    expect(factor(cheap, 'ticket').value).toBeGreaterThan(factor(dear, 'ticket').value);
    expect(factor(cheap, 'ticket').note).toMatch(/\$99/);
  });

  it('mentions what you saved against the walk-up rate', () => {
    const { score } = scoreFor(testInputs({ ticket: testTicket(150, 249) }));
    expect(factor(score, 'ticket').note).toMatch(/under the window rate/i);
  });

  it('imputes and flags a missing price rather than guessing one', () => {
    const { score } = scoreFor(testInputs({ ticket: 'unavailable' }));
    expect(factor(score, 'ticket').imputed).toBe(true);
    expect(factor(score, 'ticket').note).toMatch(/no ticket pricing/i);
  });

  /**
   * The guarantee behind the weight in config/weights.ts. Price is decision
   * context; it is not allowed to win an argument against fresh snow, and if
   * someone raises that weight, this is the test that should stop them.
   */
  it('cannot make a cheap bad day beat an expensive good one', () => {
    const cheapAndMediocre = scoreFor(
      testInputs({
        weather: testWeather({ overnightSnowIn: 0, daysSinceStorm: 8 }),
        ticket: testTicket(75, 89),
      }),
    ).score;
    const dearAndExcellent = scoreFor(
      testInputs({
        weather: testWeather({ overnightSnowIn: 12, temperatureF: 16, windMph: 5 }),
        ticket: testTicket(299, 299),
      }),
    ).score;
    expect(dearAndExcellent.score).toBeGreaterThan(cheapAndMediocre.score);
  });

  it('moves the whole score by well under a point across the entire price range', () => {
    const cheapest = scoreFor(testInputs({ ticket: testTicket(75, 89) })).score;
    const dearest = scoreFor(testInputs({ ticket: testTicket(299, 299) })).score;
    const swing = cheapest.score - dearest.score;
    expect(swing).toBeGreaterThan(0);
    expect(swing).toBeLessThan(0.8);
  });

  it('can still break a tie between two otherwise identical days', () => {
    const base = { weather: testWeather({ overnightSnowIn: 5 }) };
    const cheap = scoreFor(testInputs({ ...base, ticket: testTicket(99, 149) })).score;
    const dear = scoreFor(testInputs({ ...base, ticket: testTicket(279, 279) })).score;
    expect(cheap.raw).toBeGreaterThan(dear.raw);
  });
});

describe('grooming', () => {
  it('rescues a dry day and barely matters on a powder day', () => {
    const dry = (groomedShare: number) =>
      scoreFor(
        testInputs({
          weather: testWeather({ overnightSnowIn: 0, daysSinceStorm: 6 }),
          operations: testOperations({ groomedShare }),
        }),
      ).score.raw;
    const deep = (groomedShare: number) =>
      scoreFor(
        testInputs({
          weather: testWeather({ overnightSnowIn: 13 }),
          operations: testOperations({ groomedShare }),
        }),
      ).score.raw;

    const dryGain = dry(0.95) - dry(0.2);
    const deepGain = deep(0.95) - deep(0.2);
    expect(dryGain).toBeGreaterThan(0);
    expect(dryGain).toBeGreaterThan(deepGain);
  });
});
