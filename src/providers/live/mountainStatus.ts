import type { CrowdCurve, OperationsReport } from '@/domain/conditions';
import { holidayName, isWeekend } from '@/domain/dates';
import type { Mountain } from '@/domain/mountain';
import { type Availability, ok } from '@/domain/provenance';
import { at, clamp, clamp01, minuteRange, type MinuteOfDay } from '@/domain/time';
import { bell } from '@/lib/curve';
import type { MountainProvider, ProviderContext } from '@/providers/types';
import { getLiftieOperations } from './liftieOperations';

/**
 * Live-mode mountain status: a three-tier strategy, tried in order.
 *
 * **Tier 1 — official resort feed.** Not implemented in this pass. It would
 * need a per-resort, verified, structured (JSON/REST/GraphQL) endpoint — not
 * an HTML page — and this sandbox has no network path to any resort's site
 * to find and confirm one for even a single mountain, let alone thirteen.
 * Guessing at undocumented endpoints for a dozen different commerce/CMS
 * platforms without verification is exactly the fragile, unaccountable
 * integration this project avoids elsewhere (see the CDOT scaffold's own
 * warning). `getOperations` is written so a real Tier-1 adapter — keyed by
 * mountain id, same registry as Tier 2 — drops in per-resort without
 * touching this method's shape.
 *
 * **Tier 2 — Liftie** (`liftieOperations.ts`), a real third-party aggregator
 * with a documented API and existing Colorado coverage. Tried whenever
 * `data/resortSources.ts` has a Liftie slug for the mountain.
 *
 * **Tier 3 — unavailable.** No real signal, no invented one. The engine
 * already has a correct, tested answer for this: `scoring.ts` and
 * `snowClock.ts` impute a neutral value and flag it, which lowers confidence
 * instead of silently scoring a made-up number as if it were real (see
 * `resolveOperations`/`FALLBACK_OPS` in `engine/snowClock.ts`).
 *
 * `getCrowdForecast` is different: there genuinely is a defensible signal
 * with no live feed behind it — the calendar. Weekday vs. weekend, the
 * proximity of a real US holiday, and how popular a mountain already is with
 * the Front Range day-trip crowd are all real, verifiable facts about today,
 * not invented ones. This is a coarse proxy, not measured attendance or lift
 * queue data, and it says so in its own `drivers` list — but a proxy signal
 * that is honestly labeled is exactly what was asked for here, not a reason
 * to leave the interface unimplemented.
 */
export class LiveMountainProvider implements MountainProvider {
  readonly id = 'live-mountain-status';

  async getOperations(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<OperationsReport>> {
    // Tier 1 (official per-resort feed) has no implementation to try — see
    // the docblock above for exactly why, not just that it's missing.
    return getLiftieOperations(mountain, context);
  }

  async getCrowdForecast(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<CrowdCurve>> {
    const weekend = isWeekend(context.date);
    const holiday = holidayName(context.date);

    // Weekday baseline vs. a real weekend bump, then a real-holiday bump on
    // top of that. mountain.popularity is editorial (how much Front Range
    // day-trip demand this resort draws), not measured, and is folded in
    // exactly the way it already is for the demo model's own crowd curve.
    const dayFactor = clamp(
      (weekend ? 1 : 0.5) * (holiday ? 1.3 : 1) * (0.6 + mountain.popularity * 0.8),
      0.15,
      1.6,
    );

    const drivers: string[] = [];
    drivers.push(weekend ? 'Weekend' : 'Weekday');
    if (holiday) drivers.push(holiday);
    if (mountain.popularity > 0.8) drivers.push('Front Range favorite');
    else if (mountain.popularity < 0.5) drivers.push('Below-average draw');

    const open = mountain.operations.weekendOpen ?? mountain.operations.weekdayOpen;
    const samples = minuteRange(at(7), at(17), 15).map((minute: MinuteOfDay) => {
      const build = clamp01((minute - open) / 150);
      const fade = 1 - clamp01((minute - at(13, 30)) / 190) * 0.75;
      const lunchDip = 1 - bell(minute, at(12, 15), 45) * 0.18;
      return {
        minute,
        crowding: Math.round(clamp01(build * fade * lunchDip * dayFactor) * 100) / 100,
      };
    });

    return ok(
      { samples, dayFactor: Math.round(dayFactor * 100) / 100, drivers },
      {
        source: 'live',
        observation: 'projected',
        // A calendar-and-popularity proxy is never more than a rough guide —
        // it does not get more confident just because the date is closer.
        confidence: 'low',
        provider: this.id,
        horizonDays: context.horizonDays,
      },
    );
  }
}
