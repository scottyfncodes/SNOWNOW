import type { Origin } from '@/domain/mountain';

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
    id: 'frisco',
    name: 'Frisco (Summit County)',
    shortName: 'Frisco',
    coordinates: { lat: 39.5744, lon: -106.0973 },
  },
];

export const DEFAULT_ORIGIN_ID = 'denver';

export const findOrigin = (id: string): Origin =>
  ORIGINS.find((origin) => origin.id === id) ?? (ORIGINS[0] as Origin);
