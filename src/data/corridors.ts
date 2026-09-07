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
  'us550-durango': { id: 'us550-durango', name: 'US-550 / San Juan Skyway', shorthand: 'US-550' },
  'us160-wolfcreek': { id: 'us160-wolfcreek', name: 'US-160 / Wolf Creek Pass', shorthand: 'US-160' },
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
  'us550-durango': 0.12,
  // Empty road, serious pass. The risk here is weather, not volume.
  'us160-wolfcreek': 0.1,
  local: 0.14,
};

/**
 * Which weather region a corridor runs through, so road conditions follow the
 * storm that is actually falling on that road.
 */
export const CORRIDOR_REGION: Record<string, string> = {
  'i70-west': 'i70-corridor',
  'us285-hoosier': 'i70-corridor',
  'us6-loveland': 'i70-corridor',
  'us40-berthoud': 'i70-corridor',
  'us24-buena-vista': 'i70-corridor',
  'us50-monarch': 'san-juans',
  'us550-durango': 'san-juans',
  'us160-wolfcreek': 'san-juans',
  local: 'i70-corridor',
};

export const corridorFor = (id: string): TrafficCorridor =>
  CORRIDORS[id] ?? (CORRIDORS['local'] as TrafficCorridor);
