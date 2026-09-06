import { describe, expect, it } from 'vitest';
import { DEFAULT_PREFERENCES } from '@/config/weights';
import { MOUNTAINS } from '@/data/mountains';
import { findOrigin } from '@/data/origins';
import { at } from '@/domain/time';
import { createDemoRegistry } from '@/providers/demo';
import { testInputs, testTravel, testWeather } from '@/test/fixtures';
import { sampleCurve } from '@/lib/curve';
import { buildPlan, recommend, stayOrGo, stayOrGoLadder } from './plan';

const TODAY = '2026-01-17';
const origin = findOrigin('denver');

const afternoonWall = testTravel({
  direction: 'return',
  duration: (departure) =>
    95 *
    (1 +
      sampleCurve(
        [
          { minute: at(10), value: 0.05 },
          { minute: at(14), value: 0.2 },
          { minute: at(15, 15), value: 2.6 },
          { minute: at(16, 30), value: 3.0 },
          { minute: at(17, 45), value: 0.4 },
          { minute: at(20), value: 0.05 },
        ],
        departure,
      )),
  congestion: (departure) =>
    sampleCurve(
      [
        { minute: at(10), value: 0.05 },
        { minute: at(14), value: 0.3 },
        { minute: at(16), value: 0.99 },
        { minute: at(17, 45), value: 0.15 },
        { minute: at(20), value: 0.05 },
      ],
      departure,
    ),
});

describe('buildPlan', () => {
  it('produces a complete, timed, explained day', () => {
    const plan = buildPlan(testInputs({ weather: testWeather({ overnightSnowIn: 9 }) }));
    expect(plan.departure).not.toBeNull();
    expect(plan.return).not.toBeNull();
    expect(plan.snowClock.points.length).toBeGreaterThan(10);
    expect(plan.reasons.length).toBeGreaterThan(1);
    expect(plan.verdict).toMatch(/[A-Z]/);
    expect(plan.timeline.length).toBeGreaterThan(3);
  });

  it('orders the timeline and marks the key moments', () => {
    const plan = buildPlan(testInputs({ weather: testWeather({ overnightSnowIn: 9 }) }));
    const minutes = plan.timeline.map((event) => event.minute);
    expect(minutes).toEqual([...minutes].sort((a, b) => a - b));
    expect(plan.timeline.some((event) => event.label === 'BEST TIME TO HEAD HOME')).toBe(true);
    expect(plan.timeline.some((event) => event.label === 'Home')).toBe(true);
  });

  it('says what is missing instead of guessing', () => {
    const plan = buildPlan(testInputs({ outbound: 'unavailable' }));
    expect(plan.departure).toBeNull();
    expect(plan.caveats.join(' ')).toMatch(/road intel is offline/i);
  });

  it('flags an unreliable lift report as a caveat', () => {
    const plan = buildPlan(testInputs({ operations: 'unavailable' }));
    expect(plan.caveats.join(' ')).toMatch(/lift report/i);
  });
});

describe('recommend', () => {
  it('ranks every reachable mountain and names a winner', async () => {
    const result = await recommend(createDemoRegistry(), {
      mountains: MOUNTAINS,
      origin,
      date: TODAY,
      today: TODAY,
      now: at(4, 47),
    });
    expect(result.all.length).toBeGreaterThan(3);
    const scores = result.all.map((plan) => plan.score.raw);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
    expect(result.best).toBe(result.all[0]);
    expect(result.alternatives.length).toBe(result.all.length - 1);
  });

  it('explains why the winner won and what each alternative trades away', async () => {
    const result = await recommend(createDemoRegistry(), {
      mountains: MOUNTAINS,
      origin,
      date: TODAY,
      today: TODAY,
      now: at(4, 47),
    });
    expect(result.comparison.length).toBeGreaterThan(20);
    expect(result.comparison).toContain(result.best.mountain.shortName);
    for (const alternative of result.alternatives) {
      expect(alternative.tradeoffs.length).toBeGreaterThan(0);
    }
  });

  it('flags demo data on the recommendation itself', async () => {
    const result = await recommend(createDemoRegistry(), {
      mountains: MOUNTAINS,
      origin,
      date: TODAY,
      today: TODAY,
      now: at(4, 47),
    });
    expect(result.usingDemoData).toBe(true);
    expect(result.best.provenance.source).toBe('demo');
  });

  it('skips mountains with no route from the chosen starting point', async () => {
    const unreachable = { ...MOUNTAINS[0]!, id: 'nowhere', accessRoutes: [] };
    const result = await recommend(createDemoRegistry(), {
      mountains: [...MOUNTAINS, unreachable],
      origin,
      date: TODAY,
      today: TODAY,
      now: at(4, 47),
    });
    expect(result.all.some((plan) => plan.mountain.id === 'nowhere')).toBe(false);
  });

  it('is deterministic for the same day and starting point', async () => {
    const options = {
      mountains: MOUNTAINS,
      origin,
      date: TODAY,
      today: TODAY,
      now: at(4, 47),
    };
    const [a, b] = await Promise.all([
      recommend(createDemoRegistry(), options),
      recommend(createDemoRegistry(), options),
    ]);
    expect(a.best.mountain.id).toBe(b.best.mountain.id);
    expect(a.best.score.score).toBe(b.best.score.score);
    expect(a.best.departure?.departure).toBe(b.best.departure?.departure);
  });

  it('throws only when nothing at all is reachable', async () => {
    await expect(
      recommend(createDemoRegistry(), {
        mountains: [],
        origin,
        date: TODAY,
        today: TODAY,
        now: at(4, 47),
      }),
    ).rejects.toThrow(/reachable/i);
  });
});

describe('more snow is not automatically a better day', () => {
  it('prefers a close, well-run mountain over a deeper one behind a brutal drive', () => {
    const deepAndFar = buildPlan(
      testInputs({
        weather: testWeather({ overnightSnowIn: 16 }),
        outbound: testTravel({ direction: 'outbound', duration: () => 215, congestion: () => 0.8 }),
        inbound: testTravel({ direction: 'return', duration: () => 230, congestion: () => 0.85 }),
      }),
    );
    const shallowAndClose = buildPlan(
      testInputs({
        weather: testWeather({ overnightSnowIn: 7 }),
        outbound: testTravel({ direction: 'outbound', duration: () => 82, congestion: () => 0.08 }),
        inbound: testTravel({ direction: 'return', duration: () => 86, congestion: () => 0.1 }),
      }),
    );
    expect(shallowAndClose.score.score).toBeGreaterThan(deepAndFar.score.score);
  });
});

describe('stay or go', () => {
  const plan = () =>
    buildPlan(
      testInputs({ weather: testWeather({ overnightSnowIn: 10 }), inbound: afternoonWall }),
      { preferences: DEFAULT_PREFERENCES },
    );

  it('tells you to stay when you are standing in the middle of the wall', () => {
    const advice = stayOrGo(plan(), at(15, 12));
    expect(advice.verdict).toBe('stay');
    expect(advice.headline).toMatch(/don't leave yet|one more lap|stay a while/i);
    expect(advice.minutesToWait).toBeGreaterThan(30);
    expect(advice.leaveLater!.driveMinutes).toBeLessThan(advice.leaveNow!.driveMinutes);
    // The whole point: waiting is not just less driving, it's a better day.
    expect(advice.leaveLater!.score).toBeGreaterThan(advice.leaveNow!.score);
    expect(advice.detail).toMatch(/stay another|hang on/i);
  });

  it('calls the window open when leaving now is already the best move', () => {
    const advice = stayOrGo(plan(), plan().return!.departure);
    expect(advice.verdict).toBe('window-open');
    expect(advice.headline).toMatch(/window/i);
  });

  it('stops offering advice once the options run out', () => {
    const advice = stayOrGo(plan(), at(23, 0));
    expect(advice.verdict).toBe('go-now');
    expect(advice.leaveNow).toBeNull();
  });

  it('builds a ladder that starts at the recommendation and only looks later', () => {
    const ladder = stayOrGoLadder(plan());
    expect(ladder[0]!.recommended).toBe(true);
    for (let i = 1; i < ladder.length; i += 1) {
      expect(ladder[i]!.departure).toBeGreaterThan(ladder[i - 1]!.departure);
    }
  });
});
