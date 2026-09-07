import type { WeatherAlert } from './alerts';
import type { DateKey } from './dates';
import type { Mountain, Origin } from './mountain';
import type { TicketPrice } from './pricing';
import type { ConfidenceLevel, DisplayStatus, Provenance } from './provenance';
import type { MinuteOfDay, Minutes } from './time';

/**
 * One row of "what did this number actually come from". Built once per plan
 * so a single disclosure panel can list every input's honesty at a glance,
 * instead of the user having to trust one aggregate badge to speak for six
 * independent feeds that can each be live, stale, demo, or down on their own.
 */
export interface DataSourceStatus {
  label: string;
  status: DisplayStatus;
  provider: string;
  fetchedAt?: string;
}

/** ---- Snow clock -------------------------------------------------------- */

export interface SnowClockPoint {
  minute: MinuteOfDay;
  /** 0..100 how good the skiing is at this moment. */
  quality: number;
  /** Individual contributions, all 0..100, for explanation and testing. */
  factors: {
    freshness: number;
    surface: number;
    wind: number;
    visibility: number;
    crowding: number;
    access: number;
  };
  /** Untracked fresh snow still available, inches. */
  untrackedIn: number;
  label: string;
  /** True before first chair / after last chair. */
  closed: boolean;
}

export interface SnowWindow {
  start: MinuteOfDay;
  end: MinuteOfDay;
  peakMinute: MinuteOfDay;
  peakQuality: number;
  averageQuality: number;
}

export interface SnowClock {
  points: SnowClockPoint[];
  /** The best contiguous stretch of the day. */
  prime: SnowWindow | null;
  open: MinuteOfDay;
  close: MinuteOfDay;
  stepMinutes: Minutes;
}

/** ---- Scoring ----------------------------------------------------------- */

export type ScoreFactorKey =
  | 'snow'
  | 'snowTiming'
  | 'weather'
  | 'wind'
  | 'terrain'
  | 'operations'
  | 'travel'
  | 'traffic'
  | 'roads'
  | 'crowds'
  | 'usableTime'
  | 'ticket';

export interface ScoreFactor {
  key: ScoreFactorKey;
  label: string;
  /** 0..100 */
  value: number;
  weight: number;
  /** value * weight, before normalisation. */
  contribution: number;
  note: string;
  /** True when the factor fell back to a neutral prior because data was missing. */
  imputed: boolean;
}

export interface ScorePenalty {
  label: string;
  /** Raw points (0..100 scale) removed from the weighted average. */
  points: number;
}

export interface DayScore {
  /** 0..10, one decimal, the number on the card. */
  score: number;
  /** 0..100 internal resolution. */
  raw: number;
  factors: ScoreFactor[];
  /** Deductions applied after weighting, kept visible rather than buried. */
  penalties: ScorePenalty[];
  confidence: ConfidenceLevel;
  /** Factors that most helped / hurt, strongest first. */
  strengths: ScoreFactor[];
  weaknesses: ScoreFactor[];
}

/** ---- Departure / return optimisation ----------------------------------- */

export interface DepartureOption {
  departure: MinuteOfDay;
  arrival: MinuteOfDay;
  /** When you're actually clicked in (arrival + parking/boots). */
  firstTurn: MinuteOfDay;
  driveMinutes: Minutes;
  congestion: number;
  /** Minutes of the prime window you actually catch. */
  primeCaptured: Minutes;
  /** Quality-weighted minutes on snow — what we really optimise. */
  qualityMinutes: number;
  /** 0..100 for this departure alone. */
  score: number;
  /** True when this is the recommended departure. */
  recommended: boolean;
  /** Sleep cost relative to the earliest evaluated departure, minutes. */
  extraSleep: Minutes;
}

export interface ReturnOption {
  departure: MinuteOfDay;
  homeArrival: MinuteOfDay;
  driveMinutes: Minutes;
  congestion: number;
  /** Total minutes on the mountain if you leave at this time. */
  mountainMinutes: Minutes;
  /** Quality-weighted ski minutes gained by staying until this time. */
  qualityMinutes: number;
  score: number;
  recommended: boolean;
  /** Compared to the recommended option. */
  extraMountainMinutes: Minutes;
  extraDriveMinutes: Minutes;
  extraHomeDelayMinutes: Minutes;
  trafficLight: 'green' | 'yellow' | 'red';
}

export interface Tradeoff {
  text: string;
  /** True when this is a point in the alternative's favour. */
  better: boolean;
}

export interface TimelineEvent {
  minute: MinuteOfDay;
  icon: string;
  label: string;
  detail?: string;
  emphasis?: boolean;
}

/** ---- The plan ---------------------------------------------------------- */

export interface SkiDayPlan {
  mountain: Mountain;
  origin: Origin;
  date: DateKey;
  isToday: boolean;
  score: DayScore;
  snowClock: SnowClock;
  /** Null when pricing was unavailable — never a guessed number. */
  ticket: TicketPrice | null;
  /** Active official alerts, supplementary only — scoring never reads this. */
  alerts: WeatherAlert[];
  /** Per-feed honesty, for the "data sources" disclosure. */
  dataSources: DataSourceStatus[];
  departure: DepartureOption | null;
  departureOptions: DepartureOption[];
  return: ReturnOption | null;
  returnOptions: ReturnOption[];
  timeline: TimelineEvent[];
  /** Two or three lines of plain-language reasoning. */
  headline: string;
  verdict: string;
  reasons: string[];
  tradeoffs: Tradeoff[];
  provenance: Provenance;
  /** Human-readable notes about missing data that limited the call. */
  caveats: string[];
}

export interface Recommendation {
  date: DateKey;
  origin: Origin;
  best: SkiDayPlan;
  alternatives: SkiDayPlan[];
  all: SkiDayPlan[];
  /** Why the winner beat the runner-up, in one or two lines. */
  comparison: string;
  generatedAt: string;
  usingDemoData: boolean;
  caveats: string[];
}

export interface StayOrGoAdvice {
  /** The time the advice was computed for. */
  now: MinuteOfDay;
  verdict: 'go-now' | 'stay' | 'window-open';
  headline: string;
  detail: string;
  /** Leave right now vs. the recommended later departure. */
  leaveNow: ReturnOption | null;
  leaveLater: ReturnOption | null;
  minutesToWait: Minutes;
}
