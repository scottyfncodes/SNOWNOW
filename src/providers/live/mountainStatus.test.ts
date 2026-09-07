import { afterEach, describe, expect, it, vi } from 'vitest';
import { at } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { testMountain } from '@/test/fixtures';
import { LiveMountainProvider } from './mountainStatus';

// A real Saturday and a real Tuesday, so weekend/weekday behaviour is exact
// rather than incidental.
const SATURDAY = '2026-01-17';
const TUESDAY = '2026-01-20';
// New Year's Day: a real US holiday `holidayName` recognizes.
const NEW_YEARS = '2026-01-01';

const mountain = testMountain();

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('LiveMountainProvider — operations (tiered: Tier 1 unimplemented, Tier 2 Liftie, Tier 3 unavailable)', () => {
  it('falls through to unavailable (Tier 3) for a mountain with no known Liftie coverage — never fabricates', async () => {
    // testMountain()'s id has no entry in data/resortSources.ts.
    const provider = new LiveMountainProvider();
    const result = await provider.getOperations(mountain, makeContext(SATURDAY, SATURDAY, at(5)));
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') {
      expect(result.reason.length).toBeGreaterThan(0);
    }
  });

  it('reports real lift counts (Tier 2, Liftie) for a mountain with known coverage, honestly attributed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ lifts: { status: { open: 8, hold: 1, scheduled: 0, closed: 2 } } }),
            { status: 200 },
          ),
      ),
    );
    // Vail has a real entry in data/resortSources.ts.
    const vail = testMountain({ id: 'vail', name: 'Vail' });
    const provider = new LiveMountainProvider();
    const result = await provider.getOperations(vail, makeContext(SATURDAY, SATURDAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.liftsExpectedOpen).toBe(8);
    expect(result.data.liftsTotal).toBe(11);
    expect(result.provenance.provider).toBe('liftie');
    expect(result.provenance.attribution).toMatch(/liftie/i);
    expect(result.provenance.attribution).toMatch(/not the resort/i);
  });
});

describe('LiveMountainProvider — crowd heuristic', () => {
  it('is a genuine calendar calculation: same date and mountain always produce the same curve', async () => {
    const provider = new LiveMountainProvider();
    const context = makeContext(SATURDAY, SATURDAY, at(5));
    const a = await provider.getCrowdForecast(mountain, context);
    const b = await provider.getCrowdForecast(mountain, context);
    expect(a).toEqual(b);
  });

  it('rates a real weekend busier than a real weekday, all else equal', async () => {
    const provider = new LiveMountainProvider();
    const weekend = await provider.getCrowdForecast(mountain, makeContext(SATURDAY, SATURDAY, at(5)));
    const weekday = await provider.getCrowdForecast(mountain, makeContext(TUESDAY, TUESDAY, at(5)));
    expect(weekend.status).toBe('ok');
    expect(weekday.status).toBe('ok');
    if (weekend.status !== 'ok' || weekday.status !== 'ok') return;
    expect(weekend.data.dayFactor).toBeGreaterThan(weekday.data.dayFactor);
    expect(weekend.data.drivers).toContain('Weekend');
    expect(weekday.data.drivers).toContain('Weekday');
  });

  it('names a real holiday as a driver and rates it busier than an equivalent non-holiday weekday', async () => {
    const provider = new LiveMountainProvider();
    const holiday = await provider.getCrowdForecast(mountain, makeContext(NEW_YEARS, NEW_YEARS, at(5)));
    const plainWeekday = await provider.getCrowdForecast(mountain, makeContext(TUESDAY, TUESDAY, at(5)));
    expect(holiday.status).toBe('ok');
    expect(plainWeekday.status).toBe('ok');
    if (holiday.status !== 'ok' || plainWeekday.status !== 'ok') return;
    expect(holiday.data.drivers.some((d) => d.toLowerCase().includes('year'))).toBe(true);
    expect(holiday.data.dayFactor).toBeGreaterThan(plainWeekday.data.dayFactor);
  });

  it('rates a more popular mountain busier than a less popular one on the same day', async () => {
    const provider = new LiveMountainProvider();
    const popular = testMountain({ popularity: 0.95 });
    const quiet = testMountain({ popularity: 0.2 });
    const context = makeContext(SATURDAY, SATURDAY, at(5));
    const popularResult = await provider.getCrowdForecast(popular, context);
    const quietResult = await provider.getCrowdForecast(quiet, context);
    expect(popularResult.status).toBe('ok');
    expect(quietResult.status).toBe('ok');
    if (popularResult.status !== 'ok' || quietResult.status !== 'ok') return;
    expect(popularResult.data.dayFactor).toBeGreaterThan(quietResult.data.dayFactor);
  });

  it('is honestly labeled: live source, projected observation, low confidence — never claims to be measured', async () => {
    const provider = new LiveMountainProvider();
    const result = await provider.getCrowdForecast(mountain, makeContext(SATURDAY, SATURDAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.provenance.source).toBe('live');
    expect(result.provenance.observation).toBe('projected');
    expect(result.provenance.confidence).toBe('low');
    expect(result.provenance.fetchedAt).toBeUndefined();
  });

  it('never lets the heuristic dominate: crowding stays within a bounded range', async () => {
    const provider = new LiveMountainProvider();
    const busiest = testMountain({ popularity: 1 });
    const result = await provider.getCrowdForecast(busiest, makeContext(NEW_YEARS, NEW_YEARS, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    for (const sample of result.data.samples) {
      expect(sample.crowding).toBeGreaterThanOrEqual(0);
      expect(sample.crowding).toBeLessThanOrEqual(1);
    }
  });
});
