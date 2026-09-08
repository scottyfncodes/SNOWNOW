import type { Mountain, Origin } from '@/domain/mountain';
import { buildProjector } from '@/lib/geoProjection';
import { smoothPath } from './chart';

const WIDTH = 640;
const HEIGHT = 480;
const PADDING = 34;

export interface MapRoutePreview {
  durationMinutes: number;
  distanceMiles: number | null;
  trafficAware: boolean;
}

export interface MountainMapProps {
  mountains: Mountain[];
  origin: Origin;
  selectedMountainId: string | null;
  onSelectMountain: (mountainId: string) => void;
  /** `null` while nothing is selected or the route hasn't resolved; `'error'` when routing genuinely failed — never a guessed number. */
  route?: MapRoutePreview | 'loading' | 'error' | null;
}

/**
 * A hand-drawn schematic map, in the same spirit as the Snow Clock and
 * travel charts elsewhere in the app: real coordinates, a real projection,
 * no tile server and no mapping library. The connecting line between origin
 * and a selected mountain is a schematic route indicator — it shows *that*
 * and roughly *how far*, not a turn-by-turn road path — the numbers next to
 * it (drive time, distance) are the real, non-fabricated claim.
 */
export function MountainMap({
  mountains,
  origin,
  selectedMountainId,
  onSelectMountain,
  route,
}: MountainMapProps) {
  const points = [origin.coordinates, ...mountains.map((m) => m.coordinates)];
  const project = buildProjector(points, WIDTH, HEIGHT, PADDING);
  const originXY = project(origin.coordinates);
  const selected = mountains.find((m) => m.id === selectedMountainId) ?? null;

  const routeLine =
    selected && route && route !== 'loading' && route !== 'error'
      ? smoothPath([originXY, project(selected.coordinates)])
      : null;

  const isGps = origin.id === 'gps';

  return (
    <figure className="mountainmap">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="mountainmap-svg"
        role="img"
        aria-label={`Map of ${mountains.length} mountains relative to ${origin.name}`}
      >
        <rect x={0} y={0} width={WIDTH} height={HEIGHT} className="mountainmap-bg" rx={16} />

        {routeLine && <path d={routeLine} className="mountainmap-route" />}
        {selected && !routeLine && route !== 'loading' && (
          <line
            x1={originXY.x}
            y1={originXY.y}
            x2={project(selected.coordinates).x}
            y2={project(selected.coordinates).y}
            className="mountainmap-route is-pending"
          />
        )}

        {mountains.map((mountain) => {
          const { x, y } = project(mountain.coordinates);
          const isSelected = mountain.id === selectedMountainId;
          return (
            <g
              key={mountain.id}
              className={`mountainmap-marker${isSelected ? ' is-selected' : ''}`}
              transform={`translate(${x}, ${y})`}
              role="button"
              tabIndex={0}
              aria-label={`Select ${mountain.name}${isSelected ? ' (selected)' : ''}`}
              onClick={() => onSelectMountain(mountain.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  onSelectMountain(mountain.id);
                }
              }}
            >
              {/* A generous, invisible hit target — the visible dot is deliberately small, but the tap/click target isn't. */}
              <circle r={16} className="mountainmap-hit" />
              <circle r={isSelected ? 7 : 5} className="mountainmap-dot" />
              <text y={-11} textAnchor="middle" className="mountainmap-label">
                {mountain.shortName}
              </text>
            </g>
          );
        })}

        <g className="mountainmap-origin" transform={`translate(${originXY.x}, ${originXY.y})`}>
          <circle r={8} className={`mountainmap-origin-dot${isGps ? ' is-gps' : ''}`} />
          <circle r={14} className="mountainmap-origin-ring" />
          <text y={-18} textAnchor="middle" className="mountainmap-origin-label">
            {isGps ? 'YOU' : origin.shortName.toUpperCase()}
          </text>
        </g>
      </svg>

      <figcaption className="mountainmap-legend">
        <span className="mountainmap-legend-item">
          <span className="mountainmap-swatch is-origin" aria-hidden="true" /> {isGps ? 'Your location' : origin.shortName}
        </span>
        <span className="mountainmap-legend-item">
          <span className="mountainmap-swatch is-mountain" aria-hidden="true" /> Mountain
        </span>
      </figcaption>
    </figure>
  );
}
