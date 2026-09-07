import { CORRIDOR_REGION, corridorFor } from '@/data/corridors';
import type { RoadStatus } from '@/domain/road';
import { type Availability, confidenceForHorizon, observationForHorizon, ok } from '@/domain/provenance';
import type { ProviderContext, RoadConditionProvider } from '@/providers/types';
import { roadConditionFor } from './traffic';
import { regionalPattern } from './scenario';

/**
 * Demo road status is derived from the same regional storm pattern the demo
 * traffic provider already uses, so a demo day's "roads: snow-packed" note
 * and its corridor status never disagree with each other. It essentially
 * never reports a full closure — the demo world is built to be evaluable, and
 * a demo mountain going permanently unreachable would make that harder for
 * no benefit; the closed-corridor path is exercised by dedicated tests
 * instead of by chance in the demo generator.
 */
export class DemoRoadConditionProvider implements RoadConditionProvider {
  readonly id = 'demo-roads';

  async getCorridorStatus(
    corridorId: string,
    context: ProviderContext,
  ): Promise<Availability<RoadStatus>> {
    const region = CORRIDOR_REGION[corridorId] ?? 'i70-corridor';
    const pattern = regionalPattern(context.date, context.horizonDays, region);
    const condition = roadConditionFor(pattern.stormIntensity, 0.7, pattern.baseTempF);
    const corridor = corridorFor(corridorId);

    return ok(
      {
        corridorId,
        condition,
        closures: [],
        tractionLawInEffect: condition === 'chains-required',
        sourceTimestamp: new Date().toISOString(),
        source: `demo scenario for ${corridor.name}`,
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
