import { afterEach, describe, expect, it, vi } from 'vitest';
import { at } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { testMountain } from '@/test/fixtures';
import { NwsAlertsProvider } from './nwsAlerts';

const TODAY = '2026-01-17';
const usMountain = testMountain({ country: 'US' });
const context = makeContext(TODAY, TODAY, at(5));

afterEach(() => {
  vi.unstubAllGlobals();
});

function alertFeature(overrides: Record<string, unknown> = {}) {
  return {
    id: 'urn:test:1',
    properties: {
      event: 'Winter Storm Warning',
      headline: 'Winter Storm Warning issued',
      severity: 'Severe',
      effective: '2026-01-17T00:00:00-07:00',
      expires: '2026-01-18T06:00:00-07:00',
      areaDesc: 'Summit County',
      ...overrides,
    },
  };
}

describe('NwsAlertsProvider — normalization', () => {
  it('maps active features into WeatherAlert[]', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ features: [alertFeature()] }), { status: 200 })),
    );
    const provider = new NwsAlertsProvider();
    const result = await provider.getAlerts(usMountain, context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({ event: 'Winter Storm Warning', severity: 'severe' });
    expect(result.provenance.source).toBe('live');
  });

  it('returns a confident empty list when there are no active alerts', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ features: [] }), { status: 200 })));
    const provider = new NwsAlertsProvider();
    const result = await provider.getAlerts(usMountain, context);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data).toEqual([]);
  });

  it('skips malformed individual features rather than failing the whole call', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ features: [{ properties: {} }, alertFeature()] }), { status: 200 }),
      ),
    );
    const provider = new NwsAlertsProvider();
    const result = await provider.getAlerts(usMountain, context);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data).toHaveLength(1);
  });

  it('maps an unrecognized severity to "unknown" rather than guessing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify({ features: [alertFeature({ severity: 'Weird' })] }), { status: 200 }),
      ),
    );
    const provider = new NwsAlertsProvider();
    const result = await provider.getAlerts(usMountain, context);
    if (result.status === 'ok') expect(result.data[0]?.severity).toBe('unknown');
  });
});

describe('NwsAlertsProvider — scope', () => {
  it('never calls the network for a non-US mountain', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new NwsAlertsProvider();
    const result = await provider.getAlerts(testMountain({ country: 'CA' }), context);
    expect(result.status).toBe('ok');
    if (result.status === 'ok') expect(result.data).toEqual([]);
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});

describe('NwsAlertsProvider — failure handling', () => {
  it('returns unavailable on a non-2xx response', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 500 })));
    const provider = new NwsAlertsProvider();
    const result = await provider.getAlerts(usMountain, context);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable when the payload has no features array', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ weird: true }), { status: 200 })));
    const provider = new NwsAlertsProvider();
    const result = await provider.getAlerts(usMountain, context);
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable on a network failure, never a fabricated "no alerts"', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const provider = new NwsAlertsProvider();
    const result = await provider.getAlerts(usMountain, context);
    expect(result.status).toBe('unavailable');
  });
});
