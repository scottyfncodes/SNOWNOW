import type { OperationsReport } from '@/domain/conditions';
import type { Mountain } from '@/domain/mountain';
import { type Availability } from '@/domain/provenance';
import type { MountainProvider, ProviderContext } from '@/providers/types';
import { getLiftieOperations } from './liftieOperations';

/**
 * Live-mode mountain status: a three-tier strategy, tried in order.
 *
 * **Tier 1 — official resort feed.** Not implemented in this pass. It would
 * need a per-resort, verified, structured (JSON/REST/GraphQL) endpoint — not
 * an HTML page — and this sandbox has no network path to any resort's site
 * to find and confirm one for even a single mountain, let alone fourteen.
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
 * There used to be a `getCrowdForecast` method here too — first a
 * calendar-based heuristic (weekday/weekend, holiday, mountain popularity),
 * then, once that was recognized as a projection standing in for an
 * observed signal, an unconditional `unavailable`. It has been removed
 * entirely, not just retired to `unavailable`: no trustworthy live *or*
 * historical crowd/occupancy source exists for these resorts, so keeping a
 * permanently-dead scoring factor around — one that could only ever return
 * `unavailable` in live mode, forever, dragging every live score toward a
 * neutral filler value and every confidence rating down with it — was worse
 * than having no crowd signal at all. See `engine/scoring.ts` and
 * `engine/snowClock.ts`, which no longer have a crowds/crowding factor.
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
}
