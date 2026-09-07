import { describe, expect, it, vi } from 'vitest';
import { memoizeAsync, TtlCache } from './cache';

describe('TtlCache', () => {
  it('returns what was set, until it expires', () => {
    const cache = new TtlCache<number>(1000);
    const now = 1_000_000;
    cache.set('a', 42, 1000, now);
    expect(cache.get('a', now + 500)?.value).toBe(42);
    expect(cache.get('a', now + 1000)).toBeNull(); // expiresAt is exclusive-ish: <= now expires
  });

  it('reports a miss for a key that was never set', () => {
    const cache = new TtlCache<number>(1000);
    expect(cache.get('missing')).toBeNull();
  });

  it('deletes and clears', () => {
    const cache = new TtlCache<number>(1000);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.delete('a');
    expect(cache.get('a')).toBeNull();
    expect(cache.size).toBe(1);
    cache.clear();
    expect(cache.size).toBe(0);
  });

  it('an expired entry is evicted, not just hidden', () => {
    const cache = new TtlCache<number>(1000);
    cache.set('a', 1, 100, 0);
    cache.get('a', 200); // triggers eviction
    expect(cache.size).toBe(0);
  });
});

describe('memoizeAsync', () => {
  it('calls the fetcher once and serves the cache on a second call', async () => {
    const cache = new TtlCache<number>(60_000);
    const fetcher = vi.fn(async () => 7);
    const memo = memoizeAsync(cache);

    const first = await memo('key', fetcher);
    const second = await memo('key', fetcher);

    expect(first.value).toBe(7);
    expect(first.cached).toBe(false);
    expect(second.value).toBe(7);
    expect(second.cached).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('re-fetches once the TTL has elapsed', async () => {
    const cache = new TtlCache<number>(1);
    const fetcher = vi.fn(async () => Math.random());
    const memo = memoizeAsync(cache, 1);

    const first = await memo('key', fetcher);
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await memo('key', fetcher);

    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(first.value).not.toBe(second.value);
  });

  it('shares one in-flight call across concurrent requests for the same key', async () => {
    const cache = new TtlCache<number>(60_000);
    let calls = 0;
    const fetcher = vi.fn(async () => {
      calls += 1;
      await new Promise((resolve) => setTimeout(resolve, 10));
      return calls;
    });
    const memo = memoizeAsync(cache);

    const [a, b, c] = await Promise.all([memo('k', fetcher), memo('k', fetcher), memo('k', fetcher)]);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(a.value).toBe(1);
    expect(b.value).toBe(1);
    expect(c.value).toBe(1);
  });

  it('keeps separate keys independent', async () => {
    const cache = new TtlCache<string>(60_000);
    const memo = memoizeAsync(cache);
    const a = await memo('a', async () => 'A');
    const b = await memo('b', async () => 'B');
    expect(a.value).toBe('A');
    expect(b.value).toBe('B');
  });
});
