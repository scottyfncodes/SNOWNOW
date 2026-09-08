import { OPTIMIZER_CONFIG } from '@/config/weights';
import type { SnowClock, SnowState } from '@/domain/plan';
import type { DayInputs } from './inputs';
import { resolveWeather } from './snowClock';

/**
 * Turns the snow clock's relative "best window" plus the raw weather feed
 * into an honest, absolute claim about snow conditions.
 *
 * `findPrimeWindow` (snowClock.ts) always names the best *relative* stretch
 * of the day, even when the whole day is mediocre — that is deliberate and
 * useful for timing (when to leave, when the day peaks). It is not, on its
 * own, evidence that the snow is actually good. This module is the one place
 * that decides whether the UI is allowed to say "PRIME SNOW", and it only
 * says yes when the day's peak quality clears the same absolute bar the
 * engine already uses to mean "good" (`OPTIMIZER_CONFIG.primeQualityThreshold`).
 *
 * Current snow (what fell overnight / is falling today / fell in the last
 * 72h) is kept strictly separate from forecast snow (the next-5-day
 * `snowHistory.future` total) — a favorable forecast alone can produce
 * `building`, never `prime` or `limited`, both of which require snow that
 * has actually landed.
 */

/** Below this, a day counts as having no meaningful snow on the ground. `currentTotal` already folds in today's own snowfall (see below), so this also covers "actively snowing enough today to matter". */
const CURRENT_SNOW_FLOOR_IN = 0.5;
/** Below this, recent (72h) snow doesn't count as "some snow present" either. */
const RECENT_SNOW_FLOOR_IN = 1.5;
/** Forecast (next-5-day) snow has to clear this before it's honestly "building" — this is the ONLY branch that reads `snowHistory.future`, so a favorable forecast can never read as `prime` or `limited` on its own. */
const INCOMING_SNOW_FLOOR_IN = 2;

export function classifySnowState(inputs: DayInputs, clock: SnowClock): SnowState {
  if (inputs.weather.status !== 'ok') return 'unavailable';

  const weather = resolveWeather(inputs);
  // Today's own forecast snowfall counts as current, not "incoming" — it is
  // the same bucket the rest of the engine (scoring.ts's `snowFactor`) treats
  // as "what's on the ground today". Only `snowHistory.future` — tomorrow
  // onward — is genuinely a forecast rather than current snow.
  const dayfall = weather.hourly.reduce((sum, hour) => sum + hour.snowfallIn, 0);
  const currentTotal = weather.overnightSnowIn + dayfall;
  const recent = weather.recentSnow72hIn;
  const future = weather.snowHistory?.futureTotalIn ?? 0;

  const hasCurrentSnow = currentTotal >= CURRENT_SNOW_FLOOR_IN || recent >= RECENT_SNOW_FLOOR_IN;

  // No real snow on the ground (or falling today) at all: whatever the
  // grooming/weather-comfort quality looks like, there is no snow to call
  // "prime" or even "limited" — the only honest options are "building" (a
  // real forecast ahead) or "none".
  if (!hasCurrentSnow) return future >= INCOMING_SNOW_FLOOR_IN ? 'building' : 'none';

  const isGenuinelyPrime =
    clock.prime !== null && clock.prime.peakQuality >= OPTIMIZER_CONFIG.primeQualityThreshold;
  return isGenuinelyPrime ? 'prime' : 'limited';
}

/** Short label — safe to show as a badge or a `<dt>`. */
export const SNOW_STATE_LABEL: Record<SnowState, string> = {
  prime: 'Prime snow',
  building: 'Snow building',
  limited: 'Limited snow',
  none: 'No significant snow',
  unavailable: 'Snow data unavailable',
};

/** One honest sentence, for a caption or tooltip. */
export const SNOW_STATE_DESCRIPTION: Record<SnowState, string> = {
  prime: 'Evidence supports genuinely strong ski-quality conditions.',
  building: 'Snow is falling or meaningfully forecast, but not yet prime.',
  limited: 'Some snow is present, but coverage or quality is limited.',
  none: 'No meaningful current, recent, or incoming snow.',
  unavailable: 'No trustworthy snow data to make a call right now.',
};
