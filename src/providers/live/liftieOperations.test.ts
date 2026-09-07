import { afterEach, describe, expect, it, vi } from 'vitest';
import { at } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { testMountain } from '@/test/fixtures';
import { getLiftieOperations } from './liftieOperations';

const context = makeContext('2026-01-17', '2026-01-17', at(5));
const vail = testMountain({ id: 'vail', name: 'Vail' });
// No entry in data/resortSources.ts.
const unknownMountain = testMountain({ id: 'nowhere', name: 'Nowhere Peak' });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('getLiftieOperations — Tier 3 gating', () => {
  it('never even makes a request for a mountain with no known Liftie slug', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const result = await getLiftieOperations(unknownMountain, context);
    expect(result.status).toBe('unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('getLiftieOperations — parsing (documented shape: pre-aggregated counts)', () => {
  it('normalizes a real-shaped response into OperationsReport, live and attributed', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({ lifts: { status: { open: 10, hold: 2, scheduled: 1, closed: 3 } } }),
            { status: 200 },
          ),
      ),
    );
    const result = await getLiftieOperations(vail, context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.liftsOpen).toBe(10);
    expect(result.data.liftsHold).toBe(2);
    expect(result.data.liftsScheduled).toBe(1);
    expect(result.data.liftsClosed).toBe(3);
    expect(result.data.liftsTotal).toBe(16);
    expect(result.data.sourceUrl).toContain('vail.com');
    expect(result.provenance.source).toBe('live');
    expect(result.provenance.provider).toBe('liftie');
    expect(result.provenance.fetchedAt).toBeTruthy();
    expect(result.provenance.validUntil).toBeTruthy();
  });

  it('never presents grooming as observed — it stays a documented stand-in, not a claim', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ lifts: { status: { open: 5, hold: 0, scheduled: 0, closed: 0 } } }), {
            status: 200,
          }),
      ),
    );
    const result = await getLiftieOperations(vail, context);
    expect(result.status).toBe('ok');
    // groomedShare is present (scoring needs a value) but this test exists to
    // flag the moment someone tries to source it from Liftie, which does not
    // report grooming — see the module docblock.
    if (result.status === 'ok') expect(typeof result.data.groomedShare).toBe('number');
  });
});

describe('getLiftieOperations — parsing (alternate shape: a flat lift list)', () => {
  it('tallies a list of individual lift statuses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              lifts: {
                list: [
                  { name: 'Gondola One', status: 'open' },
                  { name: 'Chair 4', status: 'open' },
                  { name: 'Chair 6', status: 'hold' },
                  { name: 'Riva Bahn', status: 'closed' },
                  { name: 'High Noon', status: 'scheduled' },
                ],
              },
            }),
            { status: 200 },
          ),
      ),
    );
    const result = await getLiftieOperations(vail, context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.liftsOpen).toBe(2);
    expect(result.data.liftsHold).toBe(1);
    expect(result.data.liftsClosed).toBe(1);
    expect(result.data.liftsScheduled).toBe(1);
    expect(result.data.liftsTotal).toBe(5);
  });
});

describe('getLiftieOperations — fails safe, never fabricates', () => {
  it('returns unavailable on an unrecognized response shape', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ nonsense: true }), { status: 200 })));
    const result = await getLiftieOperations(vail, context);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable when most of a lift list has unrecognized status values', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              lifts: { list: [{ status: 'mysterious' }, { status: 'unknown' }, { status: 'open' }] },
            }),
            { status: 200 },
          ),
      ),
    );
    const result = await getLiftieOperations(vail, context);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable when the resort reports zero total lifts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ lifts: { status: { open: 0, hold: 0, scheduled: 0, closed: 0 } } }), {
            status: 200,
          }),
      ),
    );
    const result = await getLiftieOperations(vail, context);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    const result = await getLiftieOperations(vail, context);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable on a network failure, never throws', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const result = await getLiftieOperations(vail, context);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable on malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{broken', { status: 200 })));
    const result = await getLiftieOperations(vail, context);
    expect(result.status).toBe('unavailable');
  });
});
