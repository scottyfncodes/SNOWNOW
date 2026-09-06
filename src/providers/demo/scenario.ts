import { type DateKey, holidayName, isWeekend } from '@/domain/dates';
import type { Mountain } from '@/domain/mountain';
import { at, clamp, clamp01, type MinuteOfDay } from '@/domain/time';
import { createRng, hashSeed, type Rng } from '@/lib/random';

/**
 * The demo world.
 *
 * This module invents a plausible mid-season Colorado ski day for any date and
 * keeps it stable: the same date always produces the same world. It exists so
 * SNOWNOW can be evaluated end-to-end before any vendor API is wired up.
 *
 * Nothing here is real. Providers stamp every value with `source: 'demo'` and
 * the UI never renders demo numbers without saying so.
 */

/** Fixed per-mountain character. These biases are what make the demo *mean* something. */
export interface MountainProfile {
  /** Multiplier on regional snowfall. */
  snow: number;
  /** Multiplier on regional wind. */
  wind: number;
  /** Multiplier on lift/terrain reliability, >1 is more dependable. */
  operations: number;
  /** Multiplier on crowding. */
  crowds: number;
  /** Groomer quality bonus, applied to non-powder surface. */
  grooming: number;
  /** Extra minutes of avalanche-control / upper mountain delay on big storms. */
  controlDelay: number;
}

const PROFILES: Record<string, MountainProfile> = {
  vail: { snow: 1.34, wind: 1.05, operations: 0.96, crowds: 1.0, grooming: 1.0, controlDelay: 35 },
  'beaver-creek': { snow: 0.84, wind: 0.7, operations: 1.0, crowds: 0.72, grooming: 1.18, controlDelay: 10 },
  breckenridge: { snow: 1.08, wind: 1.3, operations: 0.88, crowds: 1.0, grooming: 1.02, controlDelay: 45 },
  keystone: { snow: 0.74, wind: 0.78, operations: 1.12, crowds: 0.88, grooming: 1.24, controlDelay: 12 },
  'crested-butte': { snow: 1.6, wind: 1.12, operations: 0.9, crowds: 0.38, grooming: 0.92, controlDelay: 40 },
  'winter-park': { snow: 1.14, wind: 1.16, operations: 0.96, crowds: 0.82, grooming: 1.06, controlDelay: 30 },
};

const NEUTRAL_PROFILE: MountainProfile = {
  snow: 1,
  wind: 1,
  operations: 1,
  crowds: 1,
  grooming: 1,
  controlDelay: 20,
};

export const profileFor = (mountainId: string): MountainProfile =>
  PROFILES[mountainId] ?? NEUTRAL_PROFILE;

export interface RegionalPattern {
  date: DateKey;
  /** 0 (bluebird, nothing falling) .. 1 (a proper cycle). */
  stormIntensity: number;
  /** Total inches that fell overnight, regionally, before any mountain bias. */
  overnightIn: number;
  /** Peak snowfall rate in inches/hour during the daytime tail of the storm. */
  daytimeRateInPerHour: number;
  /** When the daytime snowfall tapers out. */
  stormTaperMinute: MinuteOfDay;
  baseTempF: number;
  /** Degrees of warming from dawn to mid-afternoon. */
  diurnalRangeF: number;
  windBaseMph: number;
  /** 0..1, 1 = full sun. Storms suppress it. */
  sunBase: number;
  density: number;
  daysSinceStorm: number;
  recentSnow72hIn: number;
  /** Aggregate corridor demand, 1 = a normal busy Saturday. */
  demandFactor: number;
  holiday: string | null;
  weekend: boolean;
  summary: string;
}

const SEED_SALT = 'snownow-demo-v1';

/**
 * Day zero is deliberately shaped into a storm day: the product story starts
 * at 4:47am with snow on the ground, and a demo that opens on a dry Tuesday
 * teaches nobody anything. Every other date is left to the seed.
 */
function intensityFor(rng: Rng, horizonDays: number): number {
  if (horizonDays === 0) return clamp(rng.range(0.58, 0.86), 0, 1);
  const roll = rng.next();
  if (roll < 0.3) return rng.range(0, 0.16);
  if (roll < 0.62) return rng.range(0.16, 0.45);
  if (roll < 0.88) return rng.range(0.45, 0.72);
  return rng.range(0.72, 1);
}

export function regionalPattern(date: DateKey, horizonDays: number): RegionalPattern {
  const rng = createRng(hashSeed(SEED_SALT, date));
  const stormIntensity = intensityFor(rng, horizonDays);
  const storming = stormIntensity > 0.2;

  const baseTempF = rng.around(storming ? 17 : 21, 7, 2, 34);
  const density = clamp(0.045 + (baseTempF - 5) * 0.0022 + rng.range(-0.006, 0.006), 0.04, 0.13);
  const overnightIn = storming ? stormIntensity * rng.range(7, 15) : rng.range(0, 1.4);
  const daytimeRate = storming ? stormIntensity * rng.range(0.4, 1.3) : 0;
  const taper = storming ? at(8, 0) + Math.round(stormIntensity * rng.range(60, 260)) : at(6, 0);

  const daysSinceStorm = storming ? 0 : Math.round(rng.range(1, 7));
  const recentSnow72h = overnightIn + (storming ? rng.range(2, 9) * stormIntensity : rng.range(0, 5));

  const holiday = holidayName(date);
  const weekend = isWeekend(date);
  const demandFactor = clamp(
    (weekend ? 1 : 0.52) * (holiday ? 1.24 : 1) * (1 + stormIntensity * 0.34) + rng.range(-0.06, 0.06),
    0.25,
    1.7,
  );

  const summary = storming
    ? stormIntensity > 0.65
      ? 'Active storm cycle. Snow overnight, still falling into the morning.'
      : 'Light-to-moderate snow overnight, tapering through the morning.'
    : daysSinceStorm <= 2
      ? 'Between systems. Leftovers off the last storm, mostly firm and fast.'
      : 'Dry pattern. Groomers are the play.';

  return {
    date,
    stormIntensity,
    overnightIn,
    daytimeRateInPerHour: daytimeRate,
    stormTaperMinute: taper,
    baseTempF,
    diurnalRangeF: storming ? rng.range(6, 12) : rng.range(12, 22),
    windBaseMph: rng.around(storming ? 17 : 9, 7, 2, 45),
    sunBase: storming ? clamp01(0.9 - stormIntensity) : rng.range(0.65, 1),
    density,
    daysSinceStorm,
    recentSnow72hIn: recentSnow72h,
    demandFactor,
    holiday,
    weekend,
    summary,
  };
}

/** Aspect and elevation modulate how much of a regional storm each mountain sees. */
export function orographicFactor(mountain: Mountain, pattern: RegionalPattern): number {
  const elevationBoost = 1 + (mountain.weatherLocation.forecastElevationFt - 10400) / 9000;
  const aspectBoost =
    mountain.weatherLocation.aspect === 'west-facing'
      ? 1.12
      : mountain.weatherLocation.aspect === 'divide'
        ? 1.02
        : 0.9;
  const rng = createRng(hashSeed(SEED_SALT, pattern.date, mountain.id, 'oro'));
  return clamp(elevationBoost * aspectBoost * rng.around(1, 0.17, 0.62, 1.42), 0.5, 1.7);
}

export const mountainRng = (mountain: Mountain, date: DateKey, salt: string): Rng =>
  createRng(hashSeed(SEED_SALT, date, mountain.id, salt));
