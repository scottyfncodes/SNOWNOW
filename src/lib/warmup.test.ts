import { afterEach, describe, expect, it, vi } from 'vitest';
import { warmUpTrafficService } from './warmup';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('warmUpTrafficService', () => {
  it('pings the health endpoint of the configured traffic service', () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    warmUpTrafficService('https://example-traffic-proxy.test');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('https://example-traffic-proxy.test/api/health');
  });

  it('does nothing when no traffic service is configured (demo mode, or live with none set up)', () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    warmUpTrafficService(null);

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('pings a same-origin relative path when the base URL is the empty string, not "unconfigured"', () => {
    const fetchMock = vi.fn(async (_url: string, _init?: RequestInit) => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);

    warmUpTrafficService('');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe('/api/health');
  });

  it('never throws or rejects when the ping fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );

    expect(() => warmUpTrafficService('https://example-traffic-proxy.test')).not.toThrow();
    // Let the background promise settle so an unhandled rejection would surface in this test run.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
});
