import type { AlertSeverity, WeatherAlert } from '@/domain/alerts';
import type { Mountain } from '@/domain/mountain';
import { type Availability, ok, unavailable } from '@/domain/provenance';
import { fetchJson } from '@/lib/http';
import type { AlertsProvider, ProviderContext } from '@/providers/types';

const BASE_URL = 'https://api.weather.gov/alerts/active';

interface NwsAlertFeature {
  id?: string;
  properties?: {
    event?: string;
    headline?: string;
    severity?: string;
    effective?: string;
    expires?: string;
    areaDesc?: string;
  };
}

interface NwsAlertResponse {
  features?: NwsAlertFeature[];
}

const SEVERITY_MAP: Record<string, AlertSeverity> = {
  Extreme: 'extreme',
  Severe: 'severe',
  Moderate: 'moderate',
  Minor: 'minor',
};

export interface NwsAlertsOptions {
  baseUrl?: string;
}

/**
 * Official US weather alerts from the National Weather Service.
 *
 * Public API, no key. NWS asks integrators to send an identifying
 * `User-Agent`; browsers refuse to let `fetch` set that header, so this can
 * only honor that request when it runs somewhere other than a browser (a
 * server proxy, a test, a build script). It still works without one — NWS
 * simply prefers you don't — which is why this is safe to call client-side
 * for this project's scope, documented here rather than silently assumed.
 *
 * Only meaningful for US mountains; everything else gets a confident empty
 * list rather than a request that was never going to answer anything.
 */
export class NwsAlertsProvider implements AlertsProvider {
  readonly id = 'nws';

  constructor(private readonly options: NwsAlertsOptions = {}) {}

  async getAlerts(mountain: Mountain, context: ProviderContext): Promise<Availability<WeatherAlert[]>> {
    if (mountain.country !== 'US') {
      return ok([], {
        source: 'live',
        observation: 'observed',
        confidence: 'high',
        provider: this.id,
        horizonDays: context.horizonDays,
      });
    }

    const base = this.options.baseUrl ?? BASE_URL;
    const { lat, lon } = mountain.coordinates;
    const url = `${base}?point=${lat.toFixed(4)},${lon.toFixed(4)}`;

    let payload: NwsAlertResponse;
    try {
      payload = await fetchJson<NwsAlertResponse>(url, {
        timeoutMs: 6000,
        headers: { Accept: 'application/geo+json' },
      });
    } catch (error) {
      return unavailable(this.id, error instanceof Error ? error.message : 'NWS request failed.');
    }

    if (!Array.isArray(payload.features)) {
      return unavailable(this.id, 'NWS returned an unexpected alerts payload.');
    }

    const alerts: WeatherAlert[] = payload.features.flatMap((feature) => {
      const p = feature.properties;
      if (!p?.event || !p.effective || !p.expires) return [];
      return [
        {
          id: feature.id ?? `${p.event}-${p.effective}`,
          event: p.event,
          headline: p.headline ?? p.event,
          severity: SEVERITY_MAP[p.severity ?? ''] ?? 'unknown',
          effective: p.effective,
          expires: p.expires,
          areaDesc: p.areaDesc ?? '',
          source: this.id,
        },
      ];
    });

    const fetchedAt = new Date();
    return ok(alerts, {
      source: 'live',
      observation: 'observed',
      confidence: 'high',
      provider: this.id,
      horizonDays: context.horizonDays,
      fetchedAt: fetchedAt.toISOString(),
      validUntil: new Date(fetchedAt.getTime() + 15 * 60 * 1000).toISOString(),
    });
  }
}
