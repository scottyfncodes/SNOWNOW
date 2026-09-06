import type { DayScore, ScoreFactor, ScoreFactorKey, SkiDayPlan, SnowClock } from '@/domain/plan';
import { formatClock, formatDuration, formatWindowLabel } from '@/domain/time';
import type { DayInputs } from './inputs';
import { resolveOperations, resolveWeather } from './snowClock';

/**
 * Copy generation. The engine knows a great deal; the user should hear one or
 * two sentences of it. Everything here is derived from computed values — no
 * canned recommendations, no hard-coded mountains.
 */

export function verdictFor(score: number, hasSnow: boolean): string {
  if (score >= 9) return "LET'S RIDE.";
  if (score >= 8.2) return hasSnow ? 'SEND IT.' : 'GO.';
  if (score >= 7.4) return 'WORTH IT.';
  if (score >= 6.5) return 'PRETTY CHILL.';
  if (score >= 5.5) return "IT'S A DAY.";
  if (score >= 4.4) return "IT'LL DO.";
  return 'SLEEP IN.';
}

/** One line under the mountain name: the call, in the fewest words possible. */
export function headlineFor(inputs: DayInputs, clock: SnowClock, score: DayScore): string {
  const weather = resolveWeather(inputs);
  const dayfall = weather.hourly.reduce((sum, hour) => sum + hour.snowfallIn, 0);
  const stacking = dayfall > 1.2;

  if (weather.overnightSnowIn >= 8) return stacking ? "SNOW'S STILL STACKING." : 'IT DUMPED.';
  if (weather.overnightSnowIn >= 4) return stacking ? 'STILL SNOWING.' : 'FRESH ON TOP.';
  if (weather.overnightSnowIn >= 1.5) return 'A LITTLE SOMETHING ON TOP.';
  if (clock.prime && clock.prime.averageQuality >= 74) return 'GROOMERS ARE THE PLAY.';
  if (score.score < 5.5) return 'NOT THE DAY.';
  return 'FIRM AND FAST.';
}

/** Two to four short evidence lines, strongest first. */
export function reasonsFor(inputs: DayInputs, clock: SnowClock, score: DayScore): string[] {
  const weather = resolveWeather(inputs);
  const ops = resolveOperations(inputs);
  const reasons: string[] = [];

  const dayfall = weather.hourly.reduce((sum, hour) => sum + hour.snowfallIn, 0);
  if (inputs.weather.status === 'ok') {
    if (weather.overnightSnowIn >= 0.6) {
      reasons.push(
        dayfall >= 0.8
          ? `${weather.overnightSnowIn.toFixed(1)}" overnight and another ${dayfall.toFixed(1)}" expected through the morning.`
          : `${weather.overnightSnowIn.toFixed(1)}" overnight.`,
      );
    } else if (dayfall >= 0.8) {
      reasons.push(`${dayfall.toFixed(1)}" expected to fall during the day.`);
    } else {
      reasons.push(`No new snow — ${weather.daysSinceStorm} days since the last one.`);
    }
  }

  if (clock.prime) {
    reasons.push(`Best snow ${formatWindowLabel(clock.prime.start, clock.prime.end)}.`);
  }

  const wind = score.factors.find((factor) => factor.key === 'wind');
  if (wind && !wind.imputed) reasons.push(wind.note);

  if (inputs.operations.status === 'ok') {
    reasons.push(`${Math.round(ops.terrainOpenShare * 100)}% terrain expected open, ${ops.liftsExpectedOpen} lifts spinning.`);
  }

  const roads = score.factors.find((factor) => factor.key === 'roads');
  if (roads && !roads.imputed) reasons.push(roads.note);

  return reasons.slice(0, 5);
}

const FACTOR_PHRASES: Record<ScoreFactorKey, { better: string; worse: string }> = {
  snow: { better: 'More snow.', worse: 'Less fresh snow.' },
  snowTiming: { better: 'Better snow timing.', worse: 'Timing lines up worse.' },
  weather: { better: 'Better visibility.', worse: 'Flatter light.' },
  wind: { better: 'Calmer.', worse: 'Higher wind.' },
  terrain: { better: 'More terrain open.', worse: 'Less terrain open.' },
  operations: { better: 'More lifts spinning.', worse: 'Shakier lift picture.' },
  travel: { better: 'Shorter drive.', worse: 'Longer drive.' },
  traffic: { better: 'Cleaner traffic.', worse: 'Worse traffic.' },
  roads: { better: 'Better roads.', worse: 'Dicier roads.' },
  crowds: { better: 'Quieter.', worse: 'More crowded.' },
  usableTime: { better: 'More time on snow.', worse: 'Less time on snow.' },
};

/** Three short bullets contrasting an alternative with the winner. */
export function tradeoffsAgainst(alternative: DayScore, winner: DayScore, limit = 3): string[] {
  const winnerByKey = new Map(winner.factors.map((factor) => [factor.key, factor]));
  const deltas = alternative.factors
    .map((factor) => {
      const other = winnerByKey.get(factor.key);
      const delta = other ? factor.value - other.value : 0;
      return { factor, delta, magnitude: Math.abs(delta) * factor.weight };
    })
    .filter((entry) => Math.abs(entry.delta) >= 7)
    .sort((a, b) => b.magnitude - a.magnitude);

  const out: string[] = [];
  for (const entry of deltas) {
    const phrases = FACTOR_PHRASES[entry.factor.key];
    out.push(entry.delta > 0 ? phrases.better : phrases.worse);
    if (out.length >= limit) break;
  }
  return out.length > 0 ? out : ['Very close call.'];
}

/** "Vail has more snow, but Breck is the better overall day." */
export function comparisonFor(best: SkiDayPlan, runnerUp: SkiDayPlan | undefined): string {
  if (!runnerUp) return `Nothing else within reach comes close today.`;

  const bestByKey = new Map(best.score.factors.map((factor) => [factor.key, factor]));
  let rivalEdge: ScoreFactor | null = null;
  let winnerEdge: ScoreFactor | null = null;
  let rivalDelta = 0;
  let winnerDelta = 0;

  for (const factor of runnerUp.score.factors) {
    const mine = bestByKey.get(factor.key);
    if (!mine) continue;
    const delta = (factor.value - mine.value) * factor.weight;
    if (delta > rivalDelta) {
      rivalDelta = delta;
      rivalEdge = factor;
    }
    if (-delta > winnerDelta) {
      winnerDelta = -delta;
      winnerEdge = mine;
    }
  }

  const winner = best.mountain.shortName;
  const rival = runnerUp.mountain.shortName;

  if (rivalEdge && winnerEdge) {
    return `${rival} has ${describeEdge(rivalEdge)}, but ${winner} wins on ${winnerEdge.label.toLowerCase()} — and that's the difference between a good day and a great one.`;
  }
  if (winnerEdge) {
    return `${winner} takes it on ${winnerEdge.label.toLowerCase()}.`;
  }
  return `${winner} edges out ${rival} across the board.`;
}

const describeEdge = (factor: ScoreFactor): string => {
  switch (factor.key) {
    case 'snow':
      return 'more snow';
    case 'travel':
      return 'a shorter drive';
    case 'traffic':
      return 'easier traffic';
    case 'crowds':
      return 'fewer people';
    case 'terrain':
      return 'more terrain open';
    case 'wind':
      return 'less wind';
    default:
      return `better ${factor.label.toLowerCase()}`;
  }
};

/** The one-line summary of the whole plan, used for sharing and screen readers. */
export function planSummary(plan: SkiDayPlan): string {
  if (!plan.departure || !plan.return) {
    return `${plan.mountain.name}: ${plan.score.score.toFixed(1)} out of 10.`;
  }
  const prime = plan.snowClock.prime;
  const primeText = prime ? ` Best snow ${formatWindowLabel(prime.start, prime.end)}.` : '';
  return (
    `${plan.mountain.name}, ${plan.score.score.toFixed(1)} out of 10. ` +
    `Leave ${formatClock(plan.departure.departure)}, arrive ${formatClock(plan.departure.arrival)}.` +
    `${primeText} Head home ${formatClock(plan.return.departure)}, back by ${formatClock(plan.return.homeArrival)} ` +
    `after ${formatDuration(plan.return.mountainMinutes)} on the hill.`
  );
}
