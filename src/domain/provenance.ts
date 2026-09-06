/**
 * Every number SNOWNOW shows can be traced to where it came from and how much
 * we trust it. This is a product rule, not a nicety: we never render demo data
 * as if it were live, and we never render a forecast as if it were observed.
 */
export type DataSource = 'live' | 'demo';

export type Observation = 'observed' | 'forecast' | 'projected';

export type ConfidenceLevel = 'high' | 'medium' | 'low';

export interface Provenance {
  source: DataSource;
  /** observed = measured now, forecast = short-range model, projected = climatology-weighted. */
  observation: Observation;
  confidence: ConfidenceLevel;
  /** Provider that produced the value, e.g. "demo-weather". */
  provider: string;
  /** How far ahead of "now" this describes, in days. 0 = today. */
  horizonDays: number;
}

/** Successful or unavailable data, so the UI can render honest empty states. */
export type Availability<T> =
  | { status: 'ok'; data: T; provenance: Provenance }
  | { status: 'unavailable'; reason: string; provider: string };

export const ok = <T,>(data: T, provenance: Provenance): Availability<T> => ({
  status: 'ok',
  data,
  provenance,
});

export const unavailable = <T,>(provider: string, reason: string): Availability<T> => ({
  status: 'unavailable',
  reason,
  provider,
});

const CONFIDENCE_RANK: Record<ConfidenceLevel, number> = { high: 3, medium: 2, low: 1 };

export function weakestConfidence(levels: ConfidenceLevel[]): ConfidenceLevel {
  if (levels.length === 0) return 'low';
  return levels.reduce((worst, level) =>
    CONFIDENCE_RANK[level] < CONFIDENCE_RANK[worst] ? level : worst,
  );
}

/**
 * Forecast confidence decays with lead time. Beyond about a week we are
 * leaning on climatology, and the product should say so.
 */
export function confidenceForHorizon(horizonDays: number): ConfidenceLevel {
  if (horizonDays <= 2) return 'high';
  if (horizonDays <= 6) return 'medium';
  return 'low';
}

export function observationForHorizon(horizonDays: number): Observation {
  if (horizonDays === 0) return 'observed';
  if (horizonDays <= 6) return 'forecast';
  return 'projected';
}

export const confidenceLabel = (level: ConfidenceLevel): string =>
  ({ high: 'HIGH CONFIDENCE', medium: 'MEDIUM CONFIDENCE', low: 'LOW CONFIDENCE' })[level];
