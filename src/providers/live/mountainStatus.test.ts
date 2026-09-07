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

describe('LiveMountainProvider — crowds (heuristic retired)', () => {
  it('always reports unavailable — no calendar heuristic pretending to be a live signal', async () => {
    const provider = new LiveMountainProvider();
    const saturday = await provider.getCrowdForecast(mountain, makeContext(SATURDAY, SATURDAY, at(5)));
    const holiday = await provider.getCrowdForecast(mountain, makeContext(NEW_YEARS, NEW_YEARS, at(5)));
    expect(saturday.status).toBe('unavailable');
    expect(holiday.status).toBe('unavailable');
    if (saturday.status === 'unavailable') expect(saturday.reason.length).toBeGreaterThan(0);
  });

  it('never varies by weekday, holiday, or popularity — there is no live path left to react to them', async () => {
    const provider = new LiveMountainProvider();
    const popular = testMountain({ popularity: 1 });
    const quiet = testMountain({ popularity: 0.1 });
    const a = await provider.getCrowdForecast(popular, makeContext(SATURDAY, SATURDAY, at(5)));
    const b = await provider.getCrowdForecast(quiet, makeContext(TUESDAY, TUESDAY, at(5)));
    expect(a.status).toBe('unavailable');
    expect(b.status).toBe('unavailable');
  });
});
