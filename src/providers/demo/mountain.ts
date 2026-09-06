import type { CrowdCurve, OperationsReport } from '@/domain/conditions';
import { isWeekend } from '@/domain/dates';
import { type Mountain, openTimeFor } from '@/domain/mountain';
import {
  type Availability,
  confidenceForHorizon,
  ok,
  observationForHorizon,
  unavailable,
} from '@/domain/provenance';
import { at, clamp, clamp01, minuteRange } from '@/domain/time';
import { bell } from '@/lib/curve';
import type { MountainProvider, ProviderContext } from '@/providers/types';
import { mountainRng, orographicFactor, profileFor, regionalPattern } from './scenario';

export interface DemoMountainOptions {
  failOperationsFor?: (mountain: Mountain) => boolean;
  failCrowdsFor?: (mountain: Mountain) => boolean;
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

    const pattern = regionalPattern(context.date, context.horizonDays);
    const profile = profileFor(mountain.id);
    const rng = mountainRng(mountain, context.date, 'ops');
    const weekend = isWeekend(context.date);
    const scheduledOpen = openTimeFor(mountain, weekend);

    const windScale = profile.wind;
    const dayWind = pattern.windBaseMph * windScale;
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

  async getCrowdForecast(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<CrowdCurve>> {
    if (this.options.failCrowdsFor?.(mountain)) {
      return unavailable(this.id, 'No visitation signal for this mountain.');
    }

    const pattern = regionalPattern(context.date, context.horizonDays);
    const profile = profileFor(mountain.id);
    const weekend = isWeekend(context.date);
    const open = openTimeFor(mountain, weekend);

    const dayFactor = clamp(
      pattern.demandFactor * mountain.popularity * profile.crowds * 1.15,
      0.12,
      1.9,
    );

    const drivers: string[] = [];
    if (pattern.holiday) drivers.push(pattern.holiday);
    if (weekend) drivers.push('Weekend');
    else drivers.push('Weekday');
    if (pattern.stormIntensity > 0.5) drivers.push('Powder day pull');
    if (mountain.popularity > 0.85) drivers.push('Front Range favourite');
    if (mountain.popularity < 0.45) drivers.push('Too far for the day-trip crowd');

    const samples = minuteRange(at(7), at(17), 15).map((minute) => {
      // Lines build from first chair, top out around late morning, then bleed off.
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
