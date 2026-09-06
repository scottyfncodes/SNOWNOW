import type { TrafficCorridor } from '@/domain/mountain';

/**
 * Corridors are shared between mountains: everything west of Denver funnels
 * through the same tunnel, which is exactly why departure timing matters.
 */
export const CORRIDORS: Record<string, TrafficCorridor> = {
  'i70-west': { id: 'i70-west', name: 'I-70 west / Eisenhower Tunnel', shorthand: 'I-70' },
  'us285-hoosier': { id: 'us285-hoosier', name: 'US-285 / Hoosier Pass', shorthand: 'US-285' },
  'us6-loveland': { id: 'us6-loveland', name: 'US-6 / Loveland Pass', shorthand: 'US-6' },
  'us40-berthoud': { id: 'us40-berthoud', name: 'US-40 / Berthoud Pass', shorthand: 'US-40' },
  'us24-buena-vista': { id: 'us24-buena-vista', name: 'US-24 / Buena Vista', shorthand: 'US-24' },
  'us50-monarch': { id: 'us50-monarch', name: 'US-50 / Monarch Pass', shorthand: 'US-50' },
  local: { id: 'local', name: 'Local roads', shorthand: 'Local' },
};

/**
 * How badly a corridor amplifies congestion. I-70 is the extreme case: a
 * single tunnel with no realistic alternative for 40,000 skiers.
 */
export const CORRIDOR_SEVERITY: Record<string, number> = {
  'i70-west': 0.85,
  'us285-hoosier': 0.3,
  'us6-loveland': 0.4,
  'us40-berthoud': 0.5,
  'us24-buena-vista': 0.2,
  'us50-monarch': 0.16,
  local: 0.14,
};

export const corridorFor = (id: string): TrafficCorridor =>
  CORRIDORS[id] ?? (CORRIDORS['local'] as TrafficCorridor);
