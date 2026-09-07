import type { TravelCurve } from '@/domain/conditions';
import type { AccessRoute } from '@/domain/mountain';
import {
  type Availability,
  confidenceForHorizon,
  observationForHorizon,
  ok,
  unavailable,
} from '@/domain/provenance';
import { fetchJson } from '@/lib/http';
import type { ProviderContext, TrafficProvider } from '@/providers/types';

/**
 * Production traffic via Google Routes — from the browser's side of the fence.
 *
 * This client NEVER calls Google directly and NEVER sees an API key: Google
 * Routes does not serve CORS to browser requests carrying a key, and even if
 * it did, shipping that key in a static bundle would hand it to anyone who
 * opens devtools. Instead this calls a same-origin (or configured) server
 * endpoint — see `server/index.mjs` — which holds the real key, does the N
 * per-departure-time calls to Google, and hands back one aggregated
 * `TravelCurve`-shaped payload. One HTTP round trip per route per direction,
 * exactly like the demo provider's contract: the optimiser already asks for a
 * whole curve once and interpolates locally, so nothing upstream of this
 * needed to change to make that true for live data too.
 */
export interface LiveTrafficOptions {
  /** e.g. "https://snownow-server.example.com". Empty string = same origin. */
  apiBaseUrl: string;
}

interface TravelCurveResponse {
  routeLabel?: string;
  corridorShorthand?: string;
  samples?: { departure: number; durationMinutes: number; congestion: number }[];
  roadCondition?: TravelCurve['roadCondition'];
  incidents?: TravelCurve['incidents'];
  sourceTimestamp?: string;
}

export class LiveTrafficProvider implements TrafficProvider {
  readonly id = 'google-routes';

  constructor(private readonly options: LiveTrafficOptions) {}

  async getTravelCurve(
    route: AccessRoute,
    direction: 'outbound' | 'return',
    context: ProviderContext,
  ): Promise<Availability<TravelCurve>> {
    const url = `${this.options.apiBaseUrl}/api/travel-curve`;

    let payload: TravelCurveResponse;
    try {
      payload = await fetchJson<TravelCurveResponse>(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          origin: route.originPoint,
          destination: route.destinationPoint,
          direction,
          date: context.date,
        }),
        // Real routing calls take longer than a JSON GET; the server itself
        // also caches, so a slow *first* request for a corridor is expected.
        timeoutMs: 15000,
      });
    } catch (error) {
      return unavailable(this.id, describeError(error));
    }

    if (!Array.isArray(payload.samples) || payload.samples.length === 0) {
      return unavailable(this.id, 'Traffic service returned no departure samples.');
    }

    const fetchedAt = new Date();
    return ok(
      {
        routeId: route.id,
        routeLabel: payload.routeLabel ?? route.label,
        corridorShorthand: payload.corridorShorthand ?? '',
        distanceMiles: route.distanceMiles,
        direction,
        samples: payload.samples,
        roadCondition: payload.roadCondition ?? 'clear',
        incidents: payload.incidents ?? [],
      },
      {
        source: 'live',
        observation: observationForHorizon(context.horizonDays),
        confidence: confidenceForHorizon(context.horizonDays),
        provider: this.id,
        horizonDays: context.horizonDays,
        fetchedAt: fetchedAt.toISOString(),
        // Server-side cache TTL is 15 minutes; mirror that here so the badge
        // and the actual cache agree about how long this value is good for.
        validUntil: new Date(fetchedAt.getTime() + 15 * 60 * 1000).toISOString(),
      },
    );
  }
}

function describeError(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === 'ProviderTimeoutError') {
      return 'The traffic service took too long to answer.';
    }
    return error.message;
  }
  return 'Traffic service request failed.';
}
