/**
 * Official weather alerts (NWS in the US). These *supplement* the normalized
 * forecast — the engine's scoring never reads this type, it exists purely so
 * the product can say "Winter Storm Warning until 6 PM" in the skier's own
 * words instead of silently baking it into a snow number they can't see.
 */
export type AlertSeverity = 'extreme' | 'severe' | 'moderate' | 'minor' | 'unknown';

export interface WeatherAlert {
  id: string;
  event: string;
  headline: string;
  severity: AlertSeverity;
  /** ISO 8601. */
  effective: string;
  /** ISO 8601. */
  expires: string;
  areaDesc: string;
  source: string;
}

const SEVERITY_RANK: Record<AlertSeverity, number> = {
  extreme: 4,
  severe: 3,
  moderate: 2,
  minor: 1,
  unknown: 0,
};

/** The single most-worth-mentioning alert, if any. */
export function mostSevere(alerts: WeatherAlert[]): WeatherAlert | null {
  if (alerts.length === 0) return null;
  return alerts.reduce((worst, alert) =>
    SEVERITY_RANK[alert.severity] > SEVERITY_RANK[worst.severity] ? alert : worst,
  );
}
