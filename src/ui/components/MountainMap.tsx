import { useMemo } from 'react';
import type { Mountain, Origin } from '@/domain/mountain';
import { buildProjector, declutterPoints } from '@/lib/geoProjection';
import { smoothPath } from './chart';

const WIDTH = 640;
const HEIGHT = 480;
const PADDING = 34;

/**
 * Colorado's own official boundary — the 37th and 41st parallels and the
 * meridians at 102°02'48"W / 109°02'48"W (Colorado is famously one of the
 * only states drawn straight from lines of latitude and longitude). Fitting
 * the projection to these corners, not just to wherever the supported
 * mountains happen to sit, is what makes the map read as "Colorado" at a
 * glance instead of an unlabelled cluster of dots — the real notch near the
 * Four Corners is a few miles wide at this scale and is left out rather than
 * approximated.
 */
const COLORADO_BOUNDS = {
  minLat: 37,
  maxLat: 41,
  minLon: -109.045,
  maxLon: -102.042,
};
const COLORADO_CORNERS = [
  { lat: COLORADO_BOUNDS.maxLat, lon: COLORADO_BOUNDS.minLon },
  { lat: COLORADO_BOUNDS.minLat, lon: COLORADO_BOUNDS.maxLon },
];
/** Hit-circle radius, in the same SVG units as the marker layout below. */
const HIT_RADIUS = 24;
/** Two hit circles must clear this centre-to-centre distance to never overlap. */
const MIN_MARKER_SEPARATION = HIT_RADIUS * 2 + 10;
const ORIGIN_KEY = '__origin__';

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
  const geoPoints = [...COLORADO_CORNERS, origin.coordinates, ...mountains.map((m) => m.coordinates)];
  const project = buildProjector(geoPoints, WIDTH, HEIGHT, PADDING);
  const selected = mountains.find((m) => m.id === selectedMountainId) ?? null;
  const stateTopLeft = project(COLORADO_CORNERS[0]!);
  const stateBottomRight = project(COLORADO_CORNERS[1]!);

  // Several Colorado resorts (Summit County above all) sit only a few real
  // miles apart — close enough that their true projected positions can land
  // on top of each other at phone-screen scale. Markers are nudged apart just
  // enough to keep every tap target distinct; the actual route/drive numbers
  // are always computed from the real, un-nudged coordinates elsewhere.
  const layout = useMemo(() => {
    const raw = [
      { key: ORIGIN_KEY, ...project(origin.coordinates) },
      ...mountains.map((mountain) => ({ key: mountain.id, ...project(mountain.coordinates) })),
    ];
    const declustered = declutterPoints(raw, MIN_MARKER_SEPARATION);
    return new Map(declustered.map((point) => [point.key, { x: point.x, y: point.y }]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mountains, origin.coordinates.lat, origin.coordinates.lon]);

  const originXY = layout.get(ORIGIN_KEY)!;
  const positionOf = (mountain: Mountain) => layout.get(mountain.id)!;

  const routeLine =
    selected && route && route !== 'loading' && route !== 'error'
      ? smoothPath([originXY, positionOf(selected)])
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
        <rect
          x={stateTopLeft.x}
          y={stateTopLeft.y}
          width={stateBottomRight.x - stateTopLeft.x}
          height={stateBottomRight.y - stateTopLeft.y}
          className="mountainmap-state"
        />
        <text x={stateBottomRight.x - 10} y={stateBottomRight.y - 10} textAnchor="end" className="mountainmap-statelabel">
          COLORADO
        </text>

        {routeLine && <path d={routeLine} className="mountainmap-route" />}
        {selected && !routeLine && route !== 'loading' && (
          <line
            x1={originXY.x}
            y1={originXY.y}
            x2={positionOf(selected).x}
            y2={positionOf(selected).y}
            className="mountainmap-route is-pending"
          />
        )}

        {mountains.map((mountain) => {
          const { x, y } = positionOf(mountain);
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
              {/* A generous, invisible hit target — the visible dot is deliberately small, but the tap/click target isn't. Markers are decluttered above so no two of these ever overlap. */}
              <circle r={HIT_RADIUS} className="mountainmap-hit" />
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
