/**
 * Deterministic pseudo-randomness. The demo layer must produce the *same*
 * mountain day for the same (mountain, date) every time it is asked, or the
 * recommendation would flicker between renders and nothing would be testable.
 */
export function hashSeed(...parts: (string | number)[]): number {
  let h = 2166136261 >>> 0;
  const input = parts.join('|');
  for (let i = 0; i < input.length; i += 1) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

export interface Rng {
  next(): number;
  /** Uniform in [min, max). */
  range(min: number, max: number): number;
  /** Normal-ish via two samples, clamped to [min, max]. */
  around(center: number, spread: number, min?: number, max?: number): number;
  pick<T>(items: readonly T[]): T;
  chance(probability: number): boolean;
}

export function createRng(seed: number): Rng {
  let state = (seed || 1) >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    range: (min, max) => min + next() * (max - min),
    around: (center, spread, min = -Infinity, max = Infinity) => {
      const value = center + (next() + next() - 1) * spread;
      return Math.min(max, Math.max(min, value));
    },
    pick: <T,>(items: readonly T[]): T => items[Math.floor(next() * items.length)] ?? (items[0] as T),
    chance: (probability) => next() < probability,
  };
}
