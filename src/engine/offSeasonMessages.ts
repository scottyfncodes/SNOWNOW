import { MONTH_LONG } from '@/domain/dates';
import type { DateKey } from '@/domain/dates';
import { fromDateKey } from '@/domain/dates';
import type { MountainWeather } from '@/domain/conditions';
import type { Mountain } from '@/domain/mountain';
import type { MountainOperationalState, OffSeasonMessage } from '@/domain/mountainStatus';
import { createRng, hashSeed } from '@/lib/random';

/**
 * Personality for the states where a normal ski recommendation would be
 * dishonest. The humor is a garnish, chosen deterministically (seeded by
 * mountain + date, never `Math.random`) so the same day always reads the
 * same way and nothing here is flaky in a test. The `detail` line underneath
 * is the part that actually has to be true — every number in it comes from
 * `weather`/`reason`, nothing is invented.
 */

const OFF_SEASON_LINES = [
  (month: string) => `Buddy. It's ${month}. Put the skis away. We have work to do.`,
  () => "Technically ski season. Spiritually, it's still dirt season.",
  () => 'Snow depth: basically vibes.',
  (month: string) => `${month}. The lifts are dreaming of winter just like you are.`,
  () => "The mountain has currently chosen violence against skiers. Against the idea of skiers, mostly, since there's no snow.",
];

const NO_SNOW_LINES = [
  () => "There's a mountain under there somewhere. Just not enough of it in white.",
  () => 'Dirt, rock, and a chairlift with nothing to do.',
  () => "Not a ski day. Maybe a hiking day, if you're into that kind of thing.",
];

const INSUFFICIENT_COVERAGE_LINES = [
  () => "Not quite. The mountain is still wearing its summer clothes.",
  () => 'A few runs worth of hope, not yet a ski day.',
  () => "Early season. The base is more of a 'base-ish'.",
];

const CLOSED_LINES = [
  () => "Closed today. Even the mountain needs a day off sometimes.",
  () => 'Lifts are parked. So should you be.',
];

const UNKNOWN_LINES = [
  () => "We genuinely don't know what this mountain is up to right now.",
  () => "No lift report, no guess. We're not going to make one up.",
];

const LINE_BANK: Record<MountainOperationalState, ((month: string) => string)[]> = {
  OFF_SEASON: OFF_SEASON_LINES,
  NO_SNOW: NO_SNOW_LINES,
  INSUFFICIENT_COVERAGE: INSUFFICIENT_COVERAGE_LINES,
  CLOSED: CLOSED_LINES,
  LIMITED_OPERATIONS: [],
  OPEN: [],
  OPEN_WITH_RESTRICTIONS: [],
  UNKNOWN: UNKNOWN_LINES,
};

function pickLine(state: MountainOperationalState, mountain: Mountain, date: DateKey): string {
  const lines = LINE_BANK[state];
  if (lines.length === 0) return '';
  const rng = createRng(hashSeed(mountain.id, date, state));
  const monthName = MONTH_LONG[fromDateKey(date).getMonth()] ?? '';
  return rng.pick(lines)(monthName);
}

/** The real data behind the joke: current situation, and — the part that actually matters — what's coming. */
function detailFor(
  state: MountainOperationalState,
  reason: string,
  weather: MountainWeather | null,
): string {
  const history = weather?.snowHistory;
  const future = history?.futureTotalIn ?? null;
  const past = history?.pastTotalIn ?? null;

  const incomingNote =
    future !== null && future >= 6
      ? ` ${future.toFixed(0)}" is projected over the next 5 days — NOT TODAY doesn't mean NOT SOON.`
      : '';
  const recentNote = past !== null && past > 0 ? ` ${past.toFixed(0)}" has fallen over the last 5 days.` : '';

  switch (state) {
    case 'OFF_SEASON':
      return `${reason}${recentNote}${incomingNote || ' Nothing meaningful in the forecast yet.'}`;
    case 'NO_SNOW':
    case 'INSUFFICIENT_COVERAGE':
      return `${reason}${recentNote}${incomingNote}`;
    case 'CLOSED':
      return reason;
    case 'UNKNOWN':
    default:
      return reason;
  }
}

export function buildOffSeasonMessage(
  state: MountainOperationalState,
  reason: string,
  mountain: Mountain,
  date: DateKey,
  weather: MountainWeather | null,
): OffSeasonMessage | null {
  const line = pickLine(state, mountain, date);
  if (!line) return null;
  return {
    state,
    line,
    detail: detailFor(state, reason, weather),
  };
}
