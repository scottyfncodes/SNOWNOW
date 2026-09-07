import { afterEach, describe, expect, it, vi } from 'vitest';
import { fetchJson, ProviderHttpError, ProviderTimeoutError } from './http';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('fetchJson', () => {
  it('returns parsed JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    const result = await fetchJson<{ ok: boolean }>('https://example.test/data');
    expect(result).toEqual({ ok: true });
  });

  it('throws ProviderHttpError on a non-2xx response, without throwing a raw fetch error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('nope', { status: 503, statusText: 'Service Unavailable' })),
    );
    await expect(fetchJson('https://example.test/data')).rejects.toThrow(ProviderHttpError);
    await expect(fetchJson('https://example.test/data')).rejects.toMatchObject({ status: 503 });
  });

  it('throws a plain Error on malformed JSON rather than an opaque parser error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response('{not json', { status: 200 })),
    );
    await expect(fetchJson('https://example.test/data')).rejects.toThrow(/Malformed JSON/);
  });

  it('throws ProviderTimeoutError when the request takes too long', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init?: RequestInit) =>
          new Promise((_resolve, reject) => {
            init?.signal?.addEventListener('abort', () => {
              const err = new Error('aborted');
              err.name = 'AbortError';
              reject(err);
            });
          }),
      ),
    );
    await expect(fetchJson('https://example.test/slow', { timeoutMs: 20 })).rejects.toThrow(
      ProviderTimeoutError,
    );
  });

  it('propagates a genuine network failure as a plain error, not a fabricated result', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    await expect(fetchJson('https://example.test/data')).rejects.toThrow('Failed to fetch');
  });

  it('passes through method, headers and body to fetch', async () => {
    const spy = vi.fn(async () => new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', spy);
    await fetchJson('https://example.test/data', {
      method: 'POST',
      headers: { 'X-Test': '1' },
      body: JSON.stringify({ a: 1 }),
    });
    expect(spy).toHaveBeenCalledWith(
      'https://example.test/data',
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ a: 1 }) }),
    );
  });
});
