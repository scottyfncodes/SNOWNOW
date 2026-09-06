import type { DateKey } from '@/domain/dates';
import { daysBetween } from '@/domain/dates';
import type { Mountain, Origin } from '@/domain/mountain';
import type { Recommendation } from '@/domain/plan';
import type { ConfidenceLevel } from '@/domain/provenance';
import type { MinuteOfDay } from '@/domain/time';
import type { ProviderRegistry } from '@/providers/types';
import type { PlanOptions } from './plan';
import { recommend } from './plan';

/**
 * LATER — planning mode.
 *
 * Same engine, same question ("what's the best ski day I can realistically
 * have?"), different honesty budget. A Saturday four days out is a forecast; a
 * Saturday twelve days out is a pattern with a hopeful expression. We rank on
 * the score but *choose* with the confidence attached, so the product never
 * sends someone across the state on the strength of a two-week model run.
 */

export interface DayProjection {
  date: DateKey;
  horizonDays: number;
  recommendation: Recommendation;
  confidence: ConfidenceLevel;
  /** Score after discounting for forecast uncertainty; used only for ranking. */
  adjustedScore: number;
}

export interface RangeProjection {
  days: DayProjection[];
  bestBet: DayProjection | null;
  usingDemoData: boolean;
  caveats: string[];
}

const CONFIDENCE_DISCOUNT: Record<ConfidenceLevel, number> = {
  high: 0,
  medium: 0.15,
  low: 0.45,
};

export interface ProjectOptions extends PlanOptions {
  mountains: Mountain[];
  origin: Origin;
  dates: DateKey[];
  today: DateKey;
  now: MinuteOfDay;
}

export async function projectRange(
  registry: ProviderRegistry,
  options: ProjectOptions,
): Promise<RangeProjection> {
  const days = await Promise.all(
    options.dates.map(async (date): Promise<DayProjection> => {
      const recommendation = await recommend(registry, {
        mountains: options.mountains,
        origin: options.origin,
        date,
        today: options.today,
        now: options.now,
        preferences: options.preferences,
        weights: options.weights,
      });
      const confidence = recommendation.best.score.confidence;
      return {
        date,
        horizonDays: Math.max(0, daysBetween(options.today, date)),
        recommendation,
        confidence,
        adjustedScore:
          Math.round((recommendation.best.score.score - CONFIDENCE_DISCOUNT[confidence]) * 100) / 100,
      };
    }),
  );

  const bestBet = days.reduce<DayProjection | null>(
    (best, day) => (best === null || day.adjustedScore > best.adjustedScore ? day : best),
    null,
  );

  return {
    days,
    bestBet,
    usingDemoData: registry.usingDemoData,
    caveats: [...new Set(days.flatMap((day) => day.recommendation.caveats))],
  };
}
