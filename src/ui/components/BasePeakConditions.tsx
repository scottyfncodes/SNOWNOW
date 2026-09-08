import type { ElevationConditions } from '@/domain/conditions';

export interface BasePeakConditionsProps {
  base: ElevationConditions | null;
  peak: ElevationConditions | null;
}

/**
 * Base and peak, side by side, above the fold. This is the whole point of the
 * front-page requirement: temperature, wind and depth for both ends of the
 * mountain without opening anything. Peak never borrows base's numbers —
 * `null` renders as "Unavailable", not a copy.
 */
export function BasePeakConditions({ base, peak }: BasePeakConditionsProps) {
  if (!base && !peak) return null;
  return (
    <div className="basepeak" role="group" aria-label="Base and peak conditions">
      <ElevationColumn label="Base" conditions={base} />
      <ElevationColumn label="Peak" conditions={peak} />
    </div>
  );
}

function ElevationColumn({
  label,
  conditions,
}: {
  label: string;
  conditions: ElevationConditions | null;
}) {
  return (
    <div className="basepeak-col">
      <p className="basepeak-label">{label}</p>
      {conditions ? (
        <>
          <p className="basepeak-temp numeral">{Math.round(conditions.temperatureF)}°F</p>
          <p className="basepeak-sub">{Math.round(conditions.windMph)} mph</p>
          <p className="basepeak-sub">
            {conditions.snowDepthIn === null
              ? 'Depth unavailable'
              : `${Math.round(conditions.snowDepthIn)}" depth`}
          </p>
        </>
      ) : (
        <p className="basepeak-unavailable">Unavailable</p>
      )}
    </div>
  );
}
