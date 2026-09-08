import type { GeoPoint, Origin } from '@/domain/mountain';
import { nearest } from '@/lib/geo';

/**
 * Starting points. SNOWNOW optimises HOME → MOUNTAIN → SNOW → MOUNTAIN → HOME,
 * so "where you sleep" is an input to the recommendation, not a setting.
 */
export const ORIGINS: Origin[] = [
  {
    id: 'denver',
    name: 'Denver',
    shortName: 'Denver',
    coordinates: { lat: 39.7392, lon: -104.9903 },
  },
  {
    id: 'boulder',
    name: 'Boulder',
    shortName: 'Boulder',
    coordinates: { lat: 40.015, lon: -105.2705 },
  },
  {
    id: 'fort-collins',
    name: 'Fort Collins',
    shortName: 'Fort Collins',
    coordinates: { lat: 40.5853, lon: -105.0844 },
  },
  {
    id: 'colorado-springs',
    name: 'Colorado Springs',
    shortName: 'Colo. Springs',
    coordinates: { lat: 38.8339, lon: -104.8214 },
  },
  {
    id: 'durango',
    name: 'Durango',
    shortName: 'Durango',
    coordinates: { lat: 37.2753, lon: -107.8801 },
  },
  {
    id: 'frisco',
    name: 'Frisco (Summit County)',
    shortName: 'Frisco',
    coordinates: { lat: 39.5744, lon: -106.0973 },
  },
];

export const DEFAULT_ORIGIN_ID = 'denver';

export const findOrigin = (id: string): Origin =>
  ORIGINS.find((origin) => origin.id === id) ?? (ORIGINS[0] as Origin);

/**
 * There is no drive-time/traffic model for an arbitrary point — every
 * mountain's access routes are hand-authored per known origin (see
 * `data/mountains.ts`). "Use my location" therefore means "which of our
 * supported starting cities is actually closest to you", not routing from an
 * exact address — an honest approximation, not a guess dressed up as one.
 */
export const nearestOrigin = (point: GeoPoint): Origin => nearest(point, ORIGINS);
