import type { MinuteOfDay } from './time';

export interface GeoPoint {
  lat: number;
  lon: number;
}

/**
 * Pass networks are *data*, not architecture. Epic is simply the first dataset
 * loaded; nothing in the engine or UI branches on a specific pass.
 */
export type PassAffiliation = 'epic' | 'ikon' | 'mountain-collective' | 'indy' | 'independent';

export interface Elevations {
  baseFt: number;
  summitFt: number;
  verticalFt: number;
}

export interface OperatingSchedule {
  /** First chair on a normal weekday / weekend day. */
  weekdayOpen: MinuteOfDay;
  weekendOpen: MinuteOfDay;
  lastChair: MinuteOfDay;
  /** Some mountains routinely open upper terrain later than the base area. */
  upperMountainOpenOffset: number;
}

export interface LiftInventory {
  total: number;
  highSpeed: number;
  /** Lifts that are wind-sensitive; drives hold risk in the ops model. */
  windExposed: number;
}

export interface TerrainProfile {
  trails: number;
  acres: number;
  /** 0..1 share of terrain above treeline — more exposed to wind, better on storm days. */
  aboveTreelineShare: number;
  /** 0..1 share of terrain that needs a deep base before it opens. */
  lateOpeningShare: number;
}

export interface WeatherLocation {
  point: GeoPoint;
  /** Elevation the forecast is anchored to (mid-mountain). */
  forecastElevationFt: number;
  /** Which side of the divide — used by demo storm modelling. */
  aspect: 'west-facing' | 'east-facing' | 'south-facing' | 'divide';
}

/** A drivable corridor shared by several mountains (e.g. I-70 west of Denver). */
export interface TrafficCorridor {
  id: string;
  name: string;
  /** Short label used in copy, e.g. "I-70". */
  shorthand: string;
}

export interface AccessRoute {
  id: string;
  /** Origin this route is measured from. */
  originId: string;
  label: string;
  corridorId: string;
  /**
   * The two endpoints a real routing API needs. Denormalized onto the route
   * (rather than looked up from Origin/Mountain at call time) so a
   * `TrafficProvider` can build a request from `route` alone, exactly as it
   * does today for the demo model — a live provider is a drop-in, not a
   * reason to widen the interface every consumer already depends on.
   */
  originPoint: GeoPoint;
  destinationPoint: GeoPoint;
  distanceMiles: number;
  /** Free-flow drive time with no traffic and clear roads. */
  freeFlowMinutes: number;
  /** Extra minutes when roads are snow-packed, before congestion. */
  stormPenaltyMinutes: number;
  /** Higher = more likely to need chains / close in a storm. 0..1 */
  weatherSensitivity: number;
  isPrimary: boolean;
}

/**
 * Where a real routing request should actually send a driver — a base area,
 * primary parking lot, or arrival point — which is not always the same point
 * as `Mountain.coordinates` (a general geographic marker for the resort,
 * used for the map pin, distance math, and weather/scoring). Optional and
 * additive: absent for any mountain whose `coordinates` already sit at (or
 * close enough to) the practical arrival point — see `routingDestinationFor`.
 */
export interface RoutingDestination extends GeoPoint {
  /** What this point actually is, e.g. "Wild Blue Gondola base area". */
  label: string;
}

export interface Mountain {
  id: string;
  name: string;
  /** What we call it in copy: "BRECK", "VAIL". */
  shortName: string;
  /** Display region, e.g. "San Juans". */
  region: string;
  /**
   * Which weather region the mountain sits in. Storms do not arrive everywhere
   * at once: the I-70 corridor and the San Juans run on different tracks, and
   * modelling that is what lets a dry Front Range weekend still have a good
   * answer somewhere.
   */
  snowRegion: string;
  state: string;
  country: string;
  coordinates: GeoPoint;
  /** Set only when the practical driving destination differs meaningfully from `coordinates` — see `RoutingDestination`. */
  routingDestination?: RoutingDestination;
  elevations: Elevations;
  operations: OperatingSchedule;
  lifts: LiftInventory;
  terrain: TerrainProfile;
  weatherLocation: WeatherLocation;
  accessRoutes: AccessRoute[];
  passAffiliations: PassAffiliation[];
  /** Baseline crowding pull, 0..1. Front-range favourites crowd faster. */
  popularity: number;
  /** One line of character used in explanations. */
  character: string;
}

/**
 * The point a live route request (map preview, "Navigate") should actually
 * send a driver to. Falls back to `coordinates` for every mountain where
 * that's already a good enough arrival point — most of them, since these are
 * mostly base-area coordinates already, not town centers or summits.
 */
export const routingDestinationFor = (mountain: Mountain): GeoPoint => {
  const point = mountain.routingDestination ?? mountain.coordinates;
  // Strip `label` explicitly rather than relying on structural typing to
  // hide it: this value gets serialized straight into a route-preview
  // request body, which should carry exactly `{ lat, lon }`, never a stray
  // extra field riding along with it.
  return { lat: point.lat, lon: point.lon };
};

/** Where the skier starts the day. */
export interface Origin {
  id: string;
  name: string;
  shortName: string;
  coordinates: GeoPoint;
}

export const routesFrom = (mountain: Mountain, originId: string): AccessRoute[] =>
  mountain.accessRoutes.filter((route) => route.originId === originId);

export const primaryRoute = (mountain: Mountain, originId: string): AccessRoute | undefined => {
  const routes = routesFrom(mountain, originId);
  return routes.find((route) => route.isPrimary) ?? routes[0];
};

export const openTimeFor = (mountain: Mountain, weekend: boolean): MinuteOfDay =>
  weekend ? mountain.operations.weekendOpen : mountain.operations.weekdayOpen;
