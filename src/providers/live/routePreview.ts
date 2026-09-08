import type { GeoPoint } from '@/domain/mountain';
import { fetchJson, ProviderTimeoutError } from '@/lib/http';

/**
 * A single "right now" reading from the traffic proxy's `/api/route-preview`
 * endpoint — one Google Routes call, not a whole day's departure curve. Used
 * by the mountain map, which only ever needs one point-in-time duration and
 * distance for whichever mountain the user tapped, never a full curve.
 *
 * Deliberately separate from `LiveTrafficProvider` (which the optimiser's
 * whole-day pipeline uses): reusing that would cost up to 9 extra Google
 * calls per map tap for samples the map throws away.
 */
export interface RoutePreview {
  durationMinutes: number;
  distanceMiles: number | null;
}

export async function fetchRoutePreview(
  origin: GeoPoint,
  destination: GeoPoint,
  apiBaseUrl: string,
): Promise<RoutePreview> {
  const payload = await fetchJson<{ durationMinutes?: number; distanceMiles?: number | null }>(
    `${apiBaseUrl}/api/route-preview`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin, destination }),
      timeoutMs: 10000,
    },
  );
  if (typeof payload.durationMinutes !== 'number') {
    throw new Error('Route preview service returned no duration.');
  }
  return {
    durationMinutes: payload.durationMinutes,
    distanceMiles: typeof payload.distanceMiles === 'number' ? payload.distanceMiles : null,
  };
}

/** A friendly, honest read on *why* it failed — never the raw status text. */
export function describeRoutePreviewFailure(error: unknown): { message: string; likelySlowWake: boolean } {
  if (error instanceof ProviderTimeoutError) {
    return {
      message: "The route service took too long to answer — it can nap when it's quiet and take a moment to wake up.",
      likelySlowWake: true,
    };
  }
  return { message: "Couldn't reach the route service.", likelySlowWake: false };
}
