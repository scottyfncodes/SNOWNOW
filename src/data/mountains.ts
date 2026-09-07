import { findOrigin } from '@/data/origins';
import type { AccessRoute, GeoPoint, Mountain } from '@/domain/mountain';
import { at } from '@/domain/time';

/**
 * Colorado, across three pass networks and two snow regions, so the generic
 * model is exercised from day one. Adding a mountain, a pass network, or a
 * country is a data change — the engine, the scoring and the UI never learn a
 * mountain's name.
 *
 * Drive distances and free-flow times are representative demo values.
 */

interface RouteSpec {
  originId: string;
  label: string;
  corridorId: string;
  miles: number;
  freeFlow: number;
  stormPenalty: number;
  weatherSensitivity: number;
  primary?: boolean;
}

const buildRoutes = (
  mountainId: string,
  destinationPoint: GeoPoint,
  specs: RouteSpec[],
): AccessRoute[] =>
  specs.map((spec, index) => ({
    id: `${mountainId}:${spec.originId}:${index}`,
    originId: spec.originId,
    label: spec.label,
    corridorId: spec.corridorId,
    originPoint: findOrigin(spec.originId).coordinates,
    destinationPoint,
    distanceMiles: spec.miles,
    freeFlowMinutes: spec.freeFlow,
    stormPenaltyMinutes: spec.stormPenalty,
    weatherSensitivity: spec.weatherSensitivity,
    isPrimary: spec.primary ?? index === 0,
  }));

export const MOUNTAINS: Mountain[] = [
  {
    id: 'vail',
    name: 'Vail',
    shortName: 'VAIL',
    region: 'Vail Valley',
    snowRegion: 'i70-corridor',
    state: 'CO',
    country: 'US',
    coordinates: { lat: 39.6403, lon: -106.3742 },
    elevations: { baseFt: 8120, summitFt: 11570, verticalFt: 3450 },
    operations: {
      weekdayOpen: at(8, 30),
      weekendOpen: at(8, 30),
      lastChair: at(15, 45),
      upperMountainOpenOffset: 30,
    },
    lifts: { total: 31, highSpeed: 19, windExposed: 9 },
    terrain: { trails: 195, acres: 5317, aboveTreelineShare: 0.42, lateOpeningShare: 0.3 },
    weatherLocation: {
      point: { lat: 39.6061, lon: -106.3556 },
      forecastElevationFt: 10350,
      aspect: 'west-facing',
    },
    accessRoutes: buildRoutes('vail', { lat: 39.6403, lon: -106.3742 }, [
      { originId: 'denver', label: 'I-70 west', corridorId: 'i70-west', miles: 100, freeFlow: 100, stormPenalty: 22, weatherSensitivity: 0.7, primary: true },
      { originId: 'boulder', label: 'CO-93 to I-70 west', corridorId: 'i70-west', miles: 118, freeFlow: 116, stormPenalty: 24, weatherSensitivity: 0.7 },
      { originId: 'fort-collins', label: 'I-25 to I-70 west', corridorId: 'i70-west', miles: 145, freeFlow: 148, stormPenalty: 26, weatherSensitivity: 0.68 },
      { originId: 'colorado-springs', label: 'I-25 to I-70 west', corridorId: 'i70-west', miles: 168, freeFlow: 168, stormPenalty: 26, weatherSensitivity: 0.65 },
      { originId: 'frisco', label: 'I-70 over Vail Pass', corridorId: 'i70-west', miles: 30, freeFlow: 33, stormPenalty: 16, weatherSensitivity: 0.75 },
    ]),
    passAffiliations: ['epic'],
    popularity: 0.95,
    character: 'Back Bowls when it snows, and everyone knows it.',
  },
  {
    id: 'beaver-creek',
    name: 'Beaver Creek',
    shortName: 'BEAVER CREEK',
    region: 'Vail Valley',
    snowRegion: 'i70-corridor',
    state: 'CO',
    country: 'US',
    coordinates: { lat: 39.6042, lon: -106.5165 },
    elevations: { baseFt: 8100, summitFt: 11440, verticalFt: 3340 },
    operations: {
      weekdayOpen: at(8, 45),
      weekendOpen: at(8, 30),
      lastChair: at(16, 0),
      upperMountainOpenOffset: 15,
    },
    lifts: { total: 24, highSpeed: 14, windExposed: 4 },
    terrain: { trails: 150, acres: 2082, aboveTreelineShare: 0.12, lateOpeningShare: 0.18 },
    weatherLocation: {
      point: { lat: 39.5847, lon: -106.5164 },
      forecastElevationFt: 10200,
      aspect: 'west-facing',
    },
    accessRoutes: buildRoutes('beaver-creek', { lat: 39.6042, lon: -106.5165 }, [
      { originId: 'denver', label: 'I-70 west to Avon', corridorId: 'i70-west', miles: 112, freeFlow: 112, stormPenalty: 22, weatherSensitivity: 0.66, primary: true },
      { originId: 'boulder', label: 'CO-93 to I-70 west', corridorId: 'i70-west', miles: 130, freeFlow: 128, stormPenalty: 24, weatherSensitivity: 0.66 },
      { originId: 'fort-collins', label: 'I-25 to I-70 west', corridorId: 'i70-west', miles: 157, freeFlow: 160, stormPenalty: 26, weatherSensitivity: 0.64 },
      { originId: 'colorado-springs', label: 'I-25 to I-70 west', corridorId: 'i70-west', miles: 180, freeFlow: 180, stormPenalty: 26, weatherSensitivity: 0.62 },
      { originId: 'frisco', label: 'I-70 over Vail Pass', corridorId: 'i70-west', miles: 42, freeFlow: 46, stormPenalty: 16, weatherSensitivity: 0.7 },
    ]),
    passAffiliations: ['epic'],
    popularity: 0.6,
    character: 'Immaculate groomers and the shortest lift lines on the corridor.',
  },
  {
    id: 'breckenridge',
    name: 'Breckenridge',
    shortName: 'BRECK',
    region: 'Summit County',
    snowRegion: 'i70-corridor',
    state: 'CO',
    country: 'US',
    coordinates: { lat: 39.4817, lon: -106.0384 },
    elevations: { baseFt: 9600, summitFt: 12998, verticalFt: 3398 },
    operations: {
      weekdayOpen: at(8, 30),
      weekendOpen: at(8, 30),
      lastChair: at(16, 0),
      upperMountainOpenOffset: 45,
    },
    lifts: { total: 35, highSpeed: 12, windExposed: 11 },
    terrain: { trails: 187, acres: 2908, aboveTreelineShare: 0.38, lateOpeningShare: 0.26 },
    weatherLocation: {
      point: { lat: 39.4783, lon: -106.0669 },
      forecastElevationFt: 11000,
      aspect: 'divide',
    },
    accessRoutes: buildRoutes('breckenridge', { lat: 39.4817, lon: -106.0384 }, [
      { originId: 'denver', label: 'I-70 west to CO-9', corridorId: 'i70-west', miles: 80, freeFlow: 87, stormPenalty: 20, weatherSensitivity: 0.68, primary: true },
      { originId: 'denver', label: 'US-285 over Hoosier Pass', corridorId: 'us285-hoosier', miles: 105, freeFlow: 126, stormPenalty: 30, weatherSensitivity: 0.85 },
      { originId: 'boulder', label: 'CO-93 to I-70 west', corridorId: 'i70-west', miles: 98, freeFlow: 103, stormPenalty: 22, weatherSensitivity: 0.68 },
      { originId: 'fort-collins', label: 'I-25 to I-70 west', corridorId: 'i70-west', miles: 125, freeFlow: 135, stormPenalty: 24, weatherSensitivity: 0.66 },
      { originId: 'colorado-springs', label: 'US-24 over Wilkerson Pass', corridorId: 'us24-buena-vista', miles: 122, freeFlow: 137, stormPenalty: 28, weatherSensitivity: 0.8 },
      { originId: 'frisco', label: 'CO-9 south', corridorId: 'local', miles: 12, freeFlow: 17, stormPenalty: 8, weatherSensitivity: 0.5 },
    ]),
    passAffiliations: ['epic'],
    popularity: 0.92,
    character: 'Highest chairlift in North America. Alpine is glorious when the wind lets it spin.',
  },
  {
    id: 'keystone',
    name: 'Keystone',
    shortName: 'KEYSTONE',
    region: 'Summit County',
    snowRegion: 'i70-corridor',
    state: 'CO',
    country: 'US',
    coordinates: { lat: 39.6084, lon: -105.9437 },
    elevations: { baseFt: 9280, summitFt: 12408, verticalFt: 3128 },
    operations: {
      weekdayOpen: at(8, 30),
      weekendOpen: at(8, 15),
      lastChair: at(16, 0),
      upperMountainOpenOffset: 20,
    },
    lifts: { total: 20, highSpeed: 10, windExposed: 5 },
    terrain: { trails: 128, acres: 3149, aboveTreelineShare: 0.24, lateOpeningShare: 0.26 },
    weatherLocation: {
      point: { lat: 39.6, lon: -105.9542 },
      forecastElevationFt: 10800,
      aspect: 'east-facing',
    },
    accessRoutes: buildRoutes('keystone', { lat: 39.6084, lon: -105.9437 }, [
      { originId: 'denver', label: 'I-70 west to US-6', corridorId: 'i70-west', miles: 70, freeFlow: 78, stormPenalty: 18, weatherSensitivity: 0.62, primary: true },
      { originId: 'denver', label: 'US-6 over Loveland Pass', corridorId: 'us6-loveland', miles: 74, freeFlow: 92, stormPenalty: 26, weatherSensitivity: 0.9 },
      { originId: 'boulder', label: 'CO-93 to I-70 west', corridorId: 'i70-west', miles: 88, freeFlow: 94, stormPenalty: 20, weatherSensitivity: 0.62 },
      { originId: 'fort-collins', label: 'I-25 to I-70 west', corridorId: 'i70-west', miles: 115, freeFlow: 126, stormPenalty: 22, weatherSensitivity: 0.6 },
      { originId: 'colorado-springs', label: 'I-25 to I-70 west', corridorId: 'i70-west', miles: 138, freeFlow: 146, stormPenalty: 24, weatherSensitivity: 0.6 },
      { originId: 'frisco', label: 'I-70 to US-6', corridorId: 'local', miles: 14, freeFlow: 18, stormPenalty: 8, weatherSensitivity: 0.5 },
    ]),
    passAffiliations: ['epic'],
    popularity: 0.78,
    character: 'First chair is early and the early groomers are the best on the corridor.',
  },
  {
    id: 'crested-butte',
    name: 'Crested Butte',
    shortName: 'CB',
    region: 'Gunnison Valley',
    snowRegion: 'san-juans',
    state: 'CO',
    country: 'US',
    coordinates: { lat: 38.8992, lon: -106.9653 },
    elevations: { baseFt: 9375, summitFt: 12162, verticalFt: 2787 },
    operations: {
      weekdayOpen: at(9, 0),
      weekendOpen: at(9, 0),
      lastChair: at(16, 0),
      upperMountainOpenOffset: 40,
    },
    lifts: { total: 15, highSpeed: 4, windExposed: 6 },
    terrain: { trails: 121, acres: 1547, aboveTreelineShare: 0.45, lateOpeningShare: 0.4 },
    weatherLocation: {
      point: { lat: 38.9, lon: -106.9647 },
      forecastElevationFt: 10800,
      aspect: 'west-facing',
    },
    accessRoutes: buildRoutes('crested-butte', { lat: 38.8992, lon: -106.9653 }, [
      { originId: 'denver', label: 'US-285 to US-50 over Monarch', corridorId: 'us50-monarch', miles: 200, freeFlow: 218, stormPenalty: 34, weatherSensitivity: 0.8, primary: true },
      { originId: 'boulder', label: 'US-285 to US-50 over Monarch', corridorId: 'us50-monarch', miles: 222, freeFlow: 240, stormPenalty: 34, weatherSensitivity: 0.8 },
      { originId: 'fort-collins', label: 'I-25 to US-285 to US-50', corridorId: 'us50-monarch', miles: 258, freeFlow: 272, stormPenalty: 36, weatherSensitivity: 0.78 },
      { originId: 'colorado-springs', label: 'US-50 over Monarch Pass', corridorId: 'us50-monarch', miles: 162, freeFlow: 178, stormPenalty: 30, weatherSensitivity: 0.78 },
      { originId: 'frisco', label: 'CO-91 to US-24 to US-50', corridorId: 'us24-buena-vista', miles: 148, freeFlow: 164, stormPenalty: 30, weatherSensitivity: 0.76 },
      { originId: 'durango', label: 'US-550 to US-50 west', corridorId: 'us550-durango', miles: 168, freeFlow: 214, stormPenalty: 32, weatherSensitivity: 0.82 },
    ]),
    passAffiliations: ['epic'],
    popularity: 0.35,
    character: 'Deepest snow, steepest terrain, and a drive that will test the friendship.',
  },
  {
    id: 'winter-park',
    name: 'Winter Park',
    shortName: 'WP',
    region: 'Grand County',
    snowRegion: 'i70-corridor',
    state: 'CO',
    country: 'US',
    coordinates: { lat: 39.8868, lon: -105.7625 },
    elevations: { baseFt: 9000, summitFt: 12060, verticalFt: 3060 },
    operations: {
      weekdayOpen: at(9, 0),
      weekendOpen: at(8, 30),
      lastChair: at(16, 0),
      upperMountainOpenOffset: 35,
    },
    lifts: { total: 23, highSpeed: 10, windExposed: 8 },
    terrain: { trails: 166, acres: 3081, aboveTreelineShare: 0.34, lateOpeningShare: 0.32 },
    weatherLocation: {
      point: { lat: 39.8672, lon: -105.7714 },
      forecastElevationFt: 10700,
      aspect: 'east-facing',
    },
    accessRoutes: buildRoutes('winter-park', { lat: 39.8868, lon: -105.7625 }, [
      { originId: 'denver', label: 'I-70 to US-40 over Berthoud Pass', corridorId: 'us40-berthoud', miles: 67, freeFlow: 80, stormPenalty: 28, weatherSensitivity: 0.95, primary: true },
      { originId: 'boulder', label: 'CO-119 to I-70 to US-40', corridorId: 'us40-berthoud', miles: 72, freeFlow: 88, stormPenalty: 28, weatherSensitivity: 0.95 },
      { originId: 'fort-collins', label: 'I-25 to I-70 to US-40', corridorId: 'us40-berthoud', miles: 112, freeFlow: 122, stormPenalty: 30, weatherSensitivity: 0.92 },
      { originId: 'colorado-springs', label: 'I-25 to I-70 to US-40', corridorId: 'us40-berthoud', miles: 155, freeFlow: 166, stormPenalty: 30, weatherSensitivity: 0.9 },
      { originId: 'frisco', label: 'I-70 east to US-40', corridorId: 'us40-berthoud', miles: 48, freeFlow: 58, stormPenalty: 22, weatherSensitivity: 0.92 },
    ]),
    passAffiliations: ['ikon'],
    popularity: 0.7,
    character: 'Mary Jane bumps, and a pass road that decides how your morning goes.',
  },
  {
    id: 'purgatory',
    name: 'Purgatory',
    shortName: 'PURG',
    region: 'San Juans',
    snowRegion: 'san-juans',
    state: 'CO',
    country: 'US',
    coordinates: { lat: 37.6303, lon: -107.8145 },
    elevations: { baseFt: 8793, summitFt: 10822, verticalFt: 2029 },
    operations: {
      weekdayOpen: at(9, 0),
      weekendOpen: at(9, 0),
      lastChair: at(16, 0),
      upperMountainOpenOffset: 10,
    },
    lifts: { total: 11, highSpeed: 3, windExposed: 2 },
    terrain: { trails: 105, acres: 1635, aboveTreelineShare: 0.08, lateOpeningShare: 0.22 },
    weatherLocation: {
      point: { lat: 37.6303, lon: -107.8145 },
      forecastElevationFt: 9900,
      aspect: 'south-facing',
    },
    accessRoutes: buildRoutes('purgatory', { lat: 37.6303, lon: -107.8145 }, [
      { originId: 'durango', label: 'US-550 north', corridorId: 'us550-durango', miles: 26, freeFlow: 32, stormPenalty: 14, weatherSensitivity: 0.6, primary: true },
      { originId: 'colorado-springs', label: 'US-50 to US-550', corridorId: 'us550-durango', miles: 305, freeFlow: 322, stormPenalty: 34, weatherSensitivity: 0.7 },
    ]),
    passAffiliations: ['independent'],
    popularity: 0.3,
    character: 'San Juan snow, no lift lines, and a base area that never feels like a mall.',
  },
  {
    id: 'copper',
    name: 'Copper Mountain',
    shortName: 'COPPER',
    region: 'Summit County',
    snowRegion: 'i70-corridor',
    state: 'CO',
    country: 'US',
    coordinates: { lat: 39.5022, lon: -106.1497 },
    elevations: { baseFt: 9712, summitFt: 12441, verticalFt: 2729 },
    operations: {
      weekdayOpen: at(9, 0),
      weekendOpen: at(9, 0),
      lastChair: at(16, 0),
      upperMountainOpenOffset: 30,
    },
    lifts: { total: 24, highSpeed: 8, windExposed: 7 },
    terrain: { trails: 150, acres: 2490, aboveTreelineShare: 0.36, lateOpeningShare: 0.3 },
    weatherLocation: {
      point: { lat: 39.4817, lon: -106.1553 },
      forecastElevationFt: 11000,
      aspect: 'divide',
    },
    accessRoutes: buildRoutes('copper', { lat: 39.5022, lon: -106.1497 }, [
      { originId: 'denver', label: 'I-70 west to exit 195', corridorId: 'i70-west', miles: 75, freeFlow: 76, stormPenalty: 18, weatherSensitivity: 0.6, primary: true },
      { originId: 'boulder', label: 'CO-93 to I-70 west', corridorId: 'i70-west', miles: 93, freeFlow: 92, stormPenalty: 20, weatherSensitivity: 0.6 },
      { originId: 'fort-collins', label: 'I-25 to I-70 west', corridorId: 'i70-west', miles: 120, freeFlow: 124, stormPenalty: 22, weatherSensitivity: 0.58 },
      { originId: 'colorado-springs', label: 'I-25 to I-70 west', corridorId: 'i70-west', miles: 143, freeFlow: 144, stormPenalty: 24, weatherSensitivity: 0.58 },
      { originId: 'frisco', label: 'I-70 west, one exit', corridorId: 'local', miles: 8, freeFlow: 12, stormPenalty: 6, weatherSensitivity: 0.45 },
    ]),
    passAffiliations: ['ikon'],
    popularity: 0.8,
    character: 'Terrain that sorts itself west to east, right off the interstate — when the wind lets the top open.',
  },
  {
    id: 'wolf-creek',
    name: 'Wolf Creek',
    shortName: 'WOLF CREEK',
    region: 'San Juans',
    snowRegion: 'san-juans',
    state: 'CO',
    country: 'US',
    coordinates: { lat: 37.4722, lon: -106.7933 },
    elevations: { baseFt: 10300, summitFt: 11904, verticalFt: 1604 },
    operations: {
      weekdayOpen: at(9, 0),
      weekendOpen: at(8, 30),
      lastChair: at(16, 0),
      upperMountainOpenOffset: 25,
    },
    lifts: { total: 9, highSpeed: 2, windExposed: 3 },
    terrain: { trails: 77, acres: 1600, aboveTreelineShare: 0.28, lateOpeningShare: 0.12 },
    weatherLocation: {
      point: { lat: 37.4722, lon: -106.7933 },
      forecastElevationFt: 11200,
      aspect: 'divide',
    },
    accessRoutes: buildRoutes('wolf-creek', { lat: 37.4722, lon: -106.7933 }, [
      { originId: 'durango', label: 'US-160 east over Wolf Creek Pass', corridorId: 'us160-wolfcreek', miles: 83, freeFlow: 108, stormPenalty: 26, weatherSensitivity: 0.9, primary: true },
      { originId: 'colorado-springs', label: 'US-50 to US-285 to South Fork', corridorId: 'us160-wolfcreek', miles: 232, freeFlow: 258, stormPenalty: 32, weatherSensitivity: 0.8 },
      { originId: 'denver', label: 'US-285 over Poncha Pass to South Fork', corridorId: 'us160-wolfcreek', miles: 252, freeFlow: 272, stormPenalty: 34, weatherSensitivity: 0.8 },
    ]),
    passAffiliations: ['independent'],
    popularity: 0.42,
    character: 'The most snow in Colorado, a long way from anywhere, and a lift ticket that still has two digits.',
  },
];

export const findMountain = (id: string): Mountain | undefined =>
  MOUNTAINS.find((mountain) => mountain.id === id);
