import type { OperationsReport } from '@/domain/conditions';
import { isWeekend } from '@/domain/dates';
import { type Mountain, openTimeFor } from '@/domain/mountain';
import {
  type Availability,
  confidenceForHorizon,
  ok,
  observationForHorizon,
  unavailable,
} from '@/domain/provenance';
import { clamp, clamp01 } from '@/domain/time';
import type { MountainProvider, ProviderContext } from '@/providers/types';
import { exposedWind, mountainRng, orographicFactor, patternFor, profileFor } from './scenario';

export interface DemoMountainOptions {
  failOperationsFor?: (mountain: Mountain) => boolean;
}

/**
 * Operations are where a great forecast goes to die: 14 inches with the alpine
 * on wind hold and half the terrain roped is not a 14-inch day.
 */
export class DemoMountainProvider implements MountainProvider {
  readonly id = 'demo-mountain';

  constructor(private readonly options: DemoMountainOptions = {}) {}

  async getOperations(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<OperationsReport>> {
    if (this.options.failOperationsFor?.(mountain)) {
      return unavailable(this.id, 'Lift report is not responding.');
    }

    const pattern = patternFor(mountain, context.date, context.horizonDays);
    const profile = profileFor(mountain.id);
    const rng = mountainRng(mountain, context.date, 'ops');
    const weekend = isWeekend(context.date);
    const scheduledOpen = openTimeFor(mountain, weekend);

    const dayWind = exposedWind(pattern.windBaseMph, profile.wind);
    const exposedShare = mountain.lifts.windExposed / Math.max(1, mountain.lifts.total);
    const windHoldRisk = clamp01(
      ((dayWind - 16) / 34) * (0.5 + exposedShare) * (2 - profile.operations),
    );

    // Control work only happens when there is something to control.
    const controlDelay =
      pattern.stormIntensity > 0.35
        ? Math.round(profile.controlDelay * pattern.stormIntensity * rng.around(1, 0.25, 0.4, 1.6))
        : 0;
    const baseDelay = pattern.stormIntensity > 0.6 && rng.chance(0.35) ? Math.round(rng.range(10, 35)) : 0;

    const seasonCoverage = clamp01(0.55 + orographicFactor(mountain, pattern) * 0.2 + pattern.recentSnow72hIn / 40);
    const terrainOpenShare = clamp(
      seasonCoverage -
        mountain.terrain.lateOpeningShare * (1 - seasonCoverage) -
        windHoldRisk * mountain.terrain.aboveTreelineShare * 0.55,
      0.25,
      0.99,
    );

    const liftsExpectedOpen = Math.max(
      3,
      Math.round(mountain.lifts.total * clamp01(terrainOpenShare * profile.operations + 0.05)),
    );

    // Grooming is the counterweight to a thin snow year: a mountain that puts
    // the cats out every night is a genuinely better place to be on a firm day.
    const groomedShare = clamp(
      profile.grooming * (1 - pattern.stormIntensity * 0.35) * rng.around(1, 0.06, 0.85, 1.12),
      0.15,
      0.98,
    );

    const notes: string[] = [];
    if (controlDelay > 0) notes.push(`Upper mountain expected around ${formatDelay(controlDelay)} after first chair (avalanche control).`);
    if (baseDelay > 0) notes.push('Base area opening running late.');
    if (windHoldRisk > 0.5) notes.push('High wind hold risk on exposed lifts.');
    if (terrainOpenShare < 0.6) notes.push('Terrain still opening for the season.');

    const status: OperationsReport['status'] =
      windHoldRisk > 0.7 ? 'hold' : baseDelay > 0 || controlDelay > 30 ? 'delayed' : 'open';

    return ok(
      {
        expectedOpen: scheduledOpen + baseDelay,
        scheduledOpen,
        lastChair: mountain.operations.lastChair,
        liftsExpectedOpen,
        liftsTotal: mountain.lifts.total,
        terrainOpenShare: Math.round(terrainOpenShare * 100) / 100,
        groomedShare: Math.round(groomedShare * 100) / 100,
        windHoldRisk: Math.round(windHoldRisk * 100) / 100,
        upperMountainDelayMinutes: controlDelay + mountain.operations.upperMountainOpenOffset,
        status,
        notes,
      },
      {
        source: 'demo',
        observation: observationForHorizon(context.horizonDays),
        confidence: confidenceForHorizon(context.horizonDays),
        provider: this.id,
        horizonDays: context.horizonDays,
      },
    );
  }
}

const formatDelay = (minutes: number): string =>
  minutes >= 60 ? `${Math.round(minutes / 6) / 10}h` : `${minutes} min`;
