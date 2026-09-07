import type { WeatherAlert } from '@/domain/alerts';
import type { Mountain } from '@/domain/mountain';
import { type Availability, ok } from '@/domain/provenance';
import type { AlertsProvider, ProviderContext } from '@/providers/types';

/**
 * The demo world has no active weather alerts, ever — inventing a "Winter
 * Storm Warning" would be exactly the kind of fabricated authority-figure
 * claim the provenance system exists to prevent. An empty, confident `ok([])`
 * is the honest answer for a place with no real warnings to report.
 */
export class DemoAlertsProvider implements AlertsProvider {
  readonly id = 'demo-alerts';

  async getAlerts(_mountain: Mountain, context: ProviderContext): Promise<Availability<WeatherAlert[]>> {
    return ok([], {
      source: 'demo',
      observation: 'observed',
      confidence: 'high',
      provider: this.id,
      horizonDays: context.horizonDays,
    });
  }
}
