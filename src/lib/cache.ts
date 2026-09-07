/**
 * A small TTL cache for provider results.
 *
 * The optimiser evaluates a route's whole travel curve once and interpolates
 * locally — it never asks a provider for a fresh number per candidate — so
 * caching only has to protect against re-fetching the *same* (mountain, date,
 * direction) request across renders, screens, and NOW/LATER switches within
 * one session. This is intentionally in-memory and per-process: a real
 * multi-instance deployment would back this with Redis or a KV store, which
 * is a swap behind the same interface, not a rewrite.
 */
export interface CacheEntry<T> {
  value: T;
  fetchedAt: number;
  expiresAt: number;
}

export class TtlCache<T> {
  private readonly store = new Map<string, CacheEntry<T>>();

  constructor(private readonly defaultTtlMs: number) {}

  get(key: string, now = Date.now()): CacheEntry<T> | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= now) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, value: T, ttlMs = this.defaultTtlMs, now = Date.now()): CacheEntry<T> {
    const entry: CacheEntry<T> = { value, fetchedAt: now, expiresAt: now + ttlMs };
    this.store.set(key, entry);
    return entry;
  }

  delete(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get size(): number {
    return this.store.size;
  }
}

export interface MemoizedResult<T> {
  value: T;
  fetchedAt: number;
  /** True when this came from the cache rather than a fresh call. */
  cached: boolean;
}

/**
 * Wraps an async fetcher with TTL memoisation. Concurrent calls for the same
 * key while a fetch is in flight share the one promise rather than firing the
 * request twice — important here because NOW and LATER can both ask for the
 * same mountain's weather within milliseconds of each other.
 */
export function memoizeAsync<T>(cache: TtlCache<T>, ttlMs?: number) {
  const inFlight = new Map<string, Promise<T>>();

  return async (key: string, fetcher: () => Promise<T>): Promise<MemoizedResult<T>> => {
    const hit = cache.get(key);
    if (hit) return { value: hit.value, fetchedAt: hit.fetchedAt, cached: true };

    const pending = inFlight.get(key);
    if (pending) {
      const value = await pending;
      const entry = cache.get(key);
      return { value, fetchedAt: entry?.fetchedAt ?? Date.now(), cached: true };
    }

    const promise = fetcher();
    inFlight.set(key, promise);
    try {
      const value = await promise;
      const entry = cache.set(key, value, ttlMs);
      return { value, fetchedAt: entry.fetchedAt, cached: false };
    } finally {
      inFlight.delete(key);
    }
  };
}
