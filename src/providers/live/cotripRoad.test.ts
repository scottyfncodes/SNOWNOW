import { afterEach, describe, expect, it, vi } from 'vitest';
import { at } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { CotripRoadProvider } from './cotripRoad';

const context = makeContext('2026-01-17', '2026-01-17', at(5));

afterEach(() => {
  vi.unstubAllGlobals();
});

function closureFeature(route = 'I-70') {
  return {
    attributes: {
      Route: route,
      Description: 'Full closure, avalanche mitigation',
      Location: 'Eisenhower Tunnel, MP 214',
      StartDate: '2026-01-17T06:00:00Z',
      PlannedEndDate: '2026-01-17T09:00:00Z',
    },
  };
}

describe('CotripRoadProvider — best-effort, fails safe', () => {
  it('reports closed with parsed closures when a matching feature is present', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ features: [closureFeature('I-70')] }), { status: 200 })),
    );
    const provider = new CotripRoadProvider();
    const result = await provider.getCorridorStatus('i70-west', context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.condition).toBe('closed');
    expect(result.data.closures).toHaveLength(1);
    expect(result.data.closures[0]?.location).toContain('Eisenhower');
    // CDOT is an official government source, not third-party — never
    // carries the caveat that only a source like Liftie should set.
    expect(result.provenance.attribution).toBeUndefined();
  });

  it('reports clear when nothing matches the corridor route name', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ features: [closureFeature('US-40')] }), { status: 200 })),
    );
    const provider = new CotripRoadProvider();
    const result = await provider.getCorridorStatus('i70-west', context);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.condition).toBe('clear');
      expect(result.data.closures).toEqual([]);
    }
  });

  it('fails safe (unavailable) on a malformed response — never a fabricated closure or clear', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ nonsense: 1 }), { status: 200 })));
    const provider = new CotripRoadProvider();
    const result = await provider.getCorridorStatus('i70-west', context);
    expect(result.status).toBe('unavailable');
  });

  it('fails safe when the feature attributes are missing entirely', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ features: [{}, { attributes: null }] }), { status: 200 })),
    );
    const provider = new CotripRoadProvider();
    const result = await provider.getCorridorStatus('i70-west', context);
    // No crash, and nothing recognizable → no closures reported.
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.closures).toEqual([]);
  });

  it('returns unavailable on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })));
    const provider = new CotripRoadProvider();
    const result = await provider.getCorridorStatus('i70-west', context);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable on a network failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const provider = new CotripRoadProvider();
    const result = await provider.getCorridorStatus('i70-west', context);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable for a corridor with no known CDOT route mapping', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ features: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new CotripRoadProvider();
    const result = await provider.getCorridorStatus('local', context);
    expect(result.status).toBe('unavailable');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns unavailable for a corridor id this provider has never heard of', async () => {
    const provider = new CotripRoadProvider();
    const result = await provider.getCorridorStatus('made-up-corridor', context);
    expect(result.status).toBe('unavailable');
  });

  it('has a route mapping for every corridor in the dataset', async () => {
    const { CORRIDORS } = await import('@/data/corridors');
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new CotripRoadProvider();
    for (const corridorId of Object.keys(CORRIDORS)) {
      if (corridorId === 'local') continue; // Local roads have no CDOT record by design.
      const result = await provider.getCorridorStatus(corridorId, context);
      expect(result.status, `${corridorId} should resolve a CDOT route mapping`).toBe('ok');
    }
  });

  it('accepts a bare JSON array (no wrapper envelope)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify([closureFeature('I-70').attributes]), { status: 200 })),
    );
    const provider = new CotripRoadProvider();
    const result = await provider.getCorridorStatus('i70-west', context);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.condition).toBe('closed');
  });

  it('accepts an "incidents" wrapper envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ incidents: [closureFeature('I-70').attributes] }), { status: 200 }),
      ),
    );
    const provider = new CotripRoadProvider();
    const result = await provider.getCorridorStatus('i70-west', context);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data.condition).toBe('closed');
  });

  it('distinguishes a chain-law advisory from a full closure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify([
              {
                Route: 'I-70',
                Description: 'Traction law in effect westbound',
                Location: 'Vail Pass',
              },
            ]),
            { status: 200 },
          ),
      ),
    );
    const provider = new CotripRoadProvider();
    const result = await provider.getCorridorStatus('i70-west', context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.condition).toBe('chains-required');
    expect(result.data.tractionLawInEffect).toBe(true);
    // A traction-law advisory does not remove the route — only a real closure does.
    expect(result.data.closures).toEqual([]);
  });

  it('resolves the two newest corridors (Eldora, Steamboat) to real CDOT route names', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify([]), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new CotripRoadProvider();
    const eldora = await provider.getCorridorStatus('co119-eldora', context);
    const steamboat = await provider.getCorridorStatus('us40-rabbitears', context);
    expect(eldora.status).toBe('ok');
    expect(steamboat.status).toBe('ok');
  });
});
