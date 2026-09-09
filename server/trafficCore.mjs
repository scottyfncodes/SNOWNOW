/**
 * Shared Google Routes logic — imported by both the local-dev proxy
 * (`server/index.mjs`, run via `npm run server`) and the production Vercel
 * serverless functions (`api/*.mjs`). One implementation, two runtimes: a
 * long-running `node:http` process for local development, and Vercel's
 * per-request functions in production — see `api/_lib/README.md` for why
 * production moved off a standalone Render service (see README's "Going
 * live" section).
 *
 * Nothing here binds a port or knows about HTTP routing; that's each
 * runtime's own thin adapter. This module holds only the actual "call Google
 * Routes and shape the answer" logic, so the two adapters can't drift apart.
 */
export const API_KEY = process.env.GOOGLE_ROUTES_API_KEY ?? '';
export const CACHE_TTL_MS = Number(process.env.TRAFFIC_CACHE_TTL_SECONDS ?? 900) * 1000;
export const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
export const TIME_ZONE = process.env.SNOWNOW_TIME_ZONE ?? 'America/Denver';

export const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
export const REQUEST_TIMEOUT_MS = 6000;

/**
 * A structured, client-safe failure from the single-call route preview path.
 * `code` becomes the response's `error` field (a stable string the client
 * can branch on) and `message` its human-readable `message` — neither ever
 * carries the API key, a raw Google response body, or a Node stack trace;
 * whatever Google or the network actually said gets logged server-side only
 * (see `logRouteFetchFailure`).
 */
export class RouteFetchError extends Error {
  constructor(code, message, cause) {
    super(message);
    this.code = code;
    this.cause = cause;
  }
}

export const ROUTE_FETCH_ERROR_STATUS = {
  MISSING_API_KEY: 503,
  MALFORMED_REQUEST: 502,
  GOOGLE_ROUTES_ERROR: 502,
  NO_ROUTE_FOUND: 502,
  TIMEOUT: 504,
  SERVER_ERROR: 500,
};

/*
 * Departure-time grids, in minutes since local midnight. Kept deliberately
 * coarse — every point here is a real, billed Google Routes call — and the
 * client-side `travelAt` interpolation (unchanged) fills the gaps exactly as
 * it already does for the 6-minute-resolution demo curve. 9 + 11 = 20 calls
 * per (corridor, direction, date) combination, cached for CACHE_TTL_MS and
 * shared across every visitor asking about that corridor in that window —
 * not 20 calls per page load. Under Vercel this cache is per-instance, not
 * shared across concurrent invocations the way a single Render process was —
 * a real degradation (see the module doc), not a correctness issue: a cache
 * miss just costs a real Google call instead of serving stale data.
 */
export const OUTBOUND_MINUTES = [240, 270, 300, 330, 360, 390, 420, 450, 480]; // 4:00–8:00
export const RETURN_MINUTES = [630, 660, 690, 780, 810, 840, 870, 900, 960, 1020, 1080]; // 10:30–18:00

/** In-memory TTL cache. A multi-instance deployment needs a shared cache (Redis/KV) here instead. */
const cache = new Map();

export function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

export function cacheSet(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function cacheSize() {
  return cache.size;
}

/** Local wall-clock time (America/Denver, DST-aware) → an RFC3339 UTC instant Google Routes accepts. */
export function localToUtcIso(dateKey, minuteOfDay, timeZone) {
  const hour = Math.floor(minuteOfDay / 60);
  const minute = minuteOfDay % 60;
  const [year, month, day] = dateKey.split('-').map(Number);

  // Guess UTC = local, then correct by however far that guess's own rendered
  // local time is from the wall-clock time we actually wanted — two passes
  // converge because DST offsets are stable within a single day.
  let guessMs = Date.UTC(year, month - 1, day, hour, minute);
  for (let i = 0; i < 2; i += 1) {
    const rendered = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    }).formatToParts(new Date(guessMs));
    const parts = Object.fromEntries(rendered.map((p) => [p.type, p.value]));
    const renderedMs = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour),
      Number(parts.minute),
    );
    const wantedMs = Date.UTC(year, month - 1, day, hour, minute);
    guessMs += wantedMs - renderedMs;
  }
  return new Date(guessMs).toISOString();
}

export async function fetchWithTimeout(url, options, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/** One Google Routes call for one departure time. Returns null on any failure — callers skip the point. */
async function fetchOneSample(origin, destination, departureIso) {
  try {
    const response = await fetchWithTimeout(
      ROUTES_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lon } } },
          destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lon } } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          departureTime: departureIso,
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
    if (!response.ok) return null;
    const data = await response.json();
    const route = data.routes?.[0];
    if (!route?.duration) return null;
    // Google returns duration as e.g. "1234s".
    const seconds = Number(String(route.duration).replace('s', ''));
    if (!Number.isFinite(seconds)) return null;
    const distanceMeters = Number(route.distanceMeters);
    return {
      durationMinutes: Math.round(seconds / 60),
      // Real distance from Google, not a hand-authored figure — this is what
      // makes an arbitrary GPS-to-mountain route as accurate as a
      // pre-authored city route, which never had this problem to begin with.
      distanceMiles: Number.isFinite(distanceMeters) ? distanceMeters / 1609.344 : null,
    };
  } catch {
    return null;
  }
}

export async function buildTravelCurve(origin, destination, direction, date) {
  const minutes = direction === 'outbound' ? OUTBOUND_MINUTES : RETURN_MINUTES;
  const samplesRaw = await Promise.all(
    minutes.map(async (minute) => {
      const iso = localToUtcIso(date, minute, TIME_ZONE);
      const sample = await fetchOneSample(origin, destination, iso);
      return { minute, sample };
    }),
  );

  const resolved = samplesRaw.filter((d) => d.sample !== null);
  if (resolved.length === 0) return null;

  const floor = Math.min(...resolved.map((d) => d.sample.durationMinutes));
  const samples = resolved.map(({ minute, sample }) => ({
    departure: minute,
    durationMinutes: sample.durationMinutes,
    // Congestion isn't a field Google returns; it's derived here from how far
    // this sample's duration sits above the fastest sample seen across the
    // whole grid. A real, if approximate, read on relative traffic — not a
    // fabricated one.
    congestion: Math.max(0, Math.min(1, Math.round(((sample.durationMinutes - floor) / floor) * 100) / 100)),
  }));

  // Distance doesn't vary by departure time — one real reading from Google is enough.
  const withDistance = resolved.find((d) => d.sample.distanceMiles !== null);

  return {
    samples,
    roadCondition: 'clear',
    incidents: [],
    distanceMiles: withDistance ? Math.round(withDistance.sample.distanceMiles * 10) / 10 : null,
  };
}

/** Logs the real, possibly sensitive-shaped failure server-side only — never forwarded to a client response. */
export function logRouteFetchFailure(context, detail) {
  // eslint-disable-next-line no-console
  console.error(`[route-preview] ${context}:`, detail);
}

/**
 * A single "right now" reading — one Google Routes call, no departure grid.
 * Exists for the mountain map, which only ever needs one point-in-time
 * duration/distance for whichever mountain the user actually tapped, never a
 * whole day's curve. Reusing the travel-curve path for that would mean up to
 * 9 extra Google calls per tap for numbers the UI throws away.
 *
 * Also asks for the route's `encodedPolyline` — the real driven road
 * geometry, decoded client-side (`lib/polyline.ts`) to draw the actual route
 * on the map instead of a straight line pretending to be one. This is a free
 * addition to the same call: Google always returns a polyline with the
 * route, no extra request or billing.
 *
 * Throws a `RouteFetchError` on any failure, with a `code` the caller maps
 * to an HTTP status and hands straight to the client — distinguishing
 * "Google rejected the request", "Google returned nothing usable", and "we
 * couldn't reach Google in time" rather than collapsing all three into one
 * generic failure the client (and whoever's debugging it) can't tell apart.
 */
export async function fetchRoutePreview(origin, destination) {
  let response;
  try {
    response = await fetchWithTimeout(
      ROUTES_ENDPOINT,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Goog-Api-Key': API_KEY,
          'X-Goog-FieldMask': 'routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline',
        },
        body: JSON.stringify({
          origin: { location: { latLng: { latitude: origin.lat, longitude: origin.lon } } },
          destination: { location: { latLng: { latitude: destination.lat, longitude: destination.lon } } },
          travelMode: 'DRIVE',
          routingPreference: 'TRAFFIC_AWARE',
          // No departureTime: Google reads that as "now", which is exactly
          // what a map preview means by traffic-aware.
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new RouteFetchError('TIMEOUT', 'Google Routes did not respond in time.', error);
    }
    logRouteFetchFailure('network failure reaching Google Routes', error);
    throw new RouteFetchError('SERVER_ERROR', 'Failed to reach Google Routes.', error);
  }

  if (!response.ok) {
    const bodyText = await response.text().catch(() => '');
    logRouteFetchFailure(`Google Routes responded ${response.status}`, bodyText.slice(0, 2000));
    throw new RouteFetchError('GOOGLE_ROUTES_ERROR', 'Google Routes rejected the request.');
  }

  let data;
  try {
    data = await response.json();
  } catch (error) {
    logRouteFetchFailure('Google Routes returned unparseable JSON', error);
    throw new RouteFetchError('GOOGLE_ROUTES_ERROR', 'Google Routes returned an unreadable response.');
  }

  const route = data.routes?.[0];
  if (!route?.duration) {
    logRouteFetchFailure('Google Routes returned no usable route', data);
    throw new RouteFetchError('NO_ROUTE_FOUND', 'Google Routes returned no usable route for these coordinates.');
  }
  const seconds = Number(String(route.duration).replace('s', ''));
  if (!Number.isFinite(seconds)) {
    logRouteFetchFailure('Google Routes returned a malformed duration', route.duration);
    throw new RouteFetchError('NO_ROUTE_FOUND', 'Google Routes returned no usable route for these coordinates.');
  }
  const distanceMeters = Number(route.distanceMeters);
  return {
    durationMinutes: Math.round(seconds / 60),
    distanceMiles: Number.isFinite(distanceMeters) ? Math.round((distanceMeters / 1609.344) * 10) / 10 : null,
    polyline: typeof route.polyline?.encodedPolyline === 'string' ? route.polyline.encodedPolyline : null,
  };
}

export function isPoint(value) {
  return value && typeof value.lat === 'number' && typeof value.lon === 'number';
}
