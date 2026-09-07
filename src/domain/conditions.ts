import type { MinuteOfDay, Minutes } from './time';

/** ---- Weather ---------------------------------------------------------- */

export interface HourlyWeather {
  minute: MinuteOfDay;
  /** Snowfall accumulated during this hour, inches. */
  snowfallIn: number;
  temperatureF: number;
  windMph: number;
  windGustMph: number;
  /** 0..1 how much sun reaches the snow surface. */
  sunFactor: number;
  /** 0..1 visibility, 1 = bluebird. */
  visibility: number;
  /**
   * Snow water equivalent ratio proxy: lower = drier/lighter snow.
   * ~0.06 is blower powder, ~0.12 is heavy coastal-style snow.
   */
  density: number;
  /**
   * Fields below are additional, provider-sourced detail the engine does not
   * read today (the Snow Clock and scoring only use the fields above). They
   * exist so a live forecast can be normalized without throwing away what it
   * actually reported, and so a richer UI can surface them later without a
   * domain-model change. Optional because demo weather has no reason to
   * invent them.
   */
  /** 0..100, chance of any precipitation in the hour. */
  precipitationProbability?: number;
  /** 0..100, sky covered by cloud. */
  cloudCoverPct?: number;
  /** Compass degrees, 0 = true north. */
  windDirectionDeg?: number;
  /** Elevation above which precipitation falls as rain, feet. */
  freezingLevelFt?: number;
}

export interface MountainWeather {
  /** Snow that fell before the day started and is still skiable. */
  overnightSnowIn: number;
  /** Snow in the last 72h, for base/coverage reasoning. */
  recentSnow72hIn: number;
  /** Days since the last meaningful (>2in) storm. */
  daysSinceStorm: number;
  hourly: HourlyWeather[];
  summary: string;
}

/** ---- Mountain operations ---------------------------------------------- */

export type LiftStatus = 'open' | 'delayed' | 'hold' | 'closed';

export interface OperationsReport {
  /** Expected first chair for the day (may be later than scheduled). */
  expectedOpen: MinuteOfDay;
  scheduledOpen: MinuteOfDay;
  lastChair: MinuteOfDay;
  liftsExpectedOpen: number;
  liftsTotal: number;
  /** 0..1 share of terrain expected open. */
  terrainOpenShare: number;
  /**
   * 0..1 share of open terrain groomed overnight. Snow reports publish this,
   * and it is what makes a low-snow day at a grooming-focused mountain better
   * than a low-snow day anywhere else.
   */
  groomedShare: number;
  /** 0..1 probability that wind puts key lifts on hold during the day. */
  windHoldRisk: number;
  /** Upper-mountain / avalanche-control delay in minutes past scheduled open. */
  upperMountainDelayMinutes: Minutes;
  status: LiftStatus;
  notes: string[];
}

/** ---- Travel ------------------------------------------------------------ */

export type RoadCondition = 'clear' | 'wet' | 'snow-packed' | 'chains-required' | 'closed';

export interface TravelSample {
  /** Departure time this sample is measured from. */
  departure: MinuteOfDay;
  durationMinutes: Minutes;
  /** 0..1 congestion, 0 = free flow. */
  congestion: number;
}

export interface TravelIncident {
  minute: MinuteOfDay;
  description: string;
  delayMinutes: Minutes;
}

/**
 * Departure-time-dependent travel. The single most important thing SNOWNOW
 * knows that a navigation app does not surface: leaving 20 minutes later can
 * cost you an hour.
 */
export interface TravelCurve {
  routeId: string;
  routeLabel: string;
  corridorShorthand: string;
  distanceMiles: number;
  direction: 'outbound' | 'return';
  samples: TravelSample[];
  roadCondition: RoadCondition;
  incidents: TravelIncident[];
}

export interface CrowdCurve {
  /** 0..1 crowding by minute of day at the mountain. */
  samples: { minute: MinuteOfDay; crowding: number }[];
  /** Expected relative visitation for the day, 1 = a normal day. */
  dayFactor: number;
  drivers: string[];
}
