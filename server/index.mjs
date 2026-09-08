#!/usr/bin/env node
/**
 * SNOWNOW traffic proxy.
 *
 * The one server-side thing this project needs. Google Routes API does not
 * serve CORS to browser requests carrying a key, and even if it did, shipping
 * a key in a static bundle hands it to anyone who opens devtools — so this
 * process holds the real `GOOGLE_ROUTES_API_KEY`, makes the actual routing
 * calls, and returns the client a plain JSON travel curve with no secret
 * anywhere in the response.
 *
 * Deliberately dependency-free (no Express): this is a small, single-purpose
 * proxy, not an application server, and a plain `node:http` router is easier
 * to audit for "does this leak the key anywhere" than a framework would be.
 *
 * Run: GOOGLE_ROUTES_API_KEY=... node server/index.mjs
 * See .env.example for every variable this reads.
 */
import { createServer } from 'node:http';

const PORT = Number(process.env.PORT ?? 8787);
const API_KEY = process.env.GOOGLE_ROUTES_API_KEY ?? '';
const CACHE_TTL_MS = Number(process.env.TRAFFIC_CACHE_TTL_SECONDS ?? 900) * 1000;
const CORS_ORIGIN = process.env.CORS_ORIGIN ?? '*';
const TIME_ZONE = process.env.SNOWNOW_TIME_ZONE ?? 'America/Denver';

const ROUTES_ENDPOINT = 'https://routes.googleapis.com/directions/v2:computeRoutes';
const REQUEST_TIMEOUT_MS = 6000;

/*
 * Departure-time grids, in minutes since local midnight. Kept deliberately
 * coarse — every point here is a real, billed Google Routes call — and the
 * client-side `travelAt` interpolation (unchanged) fills the gaps exactly as
 * it already does for the 6-minute-resolution demo curve. 9 + 11 = 20 calls
 * per (corridor, direction, date) combination, cached for CACHE_TTL_MS and
 * shared across every visitor asking about that corridor in that window —
 * not 20 calls per page load.
 */
const OUTBOUND_MINUTES = [240, 270, 300, 330, 360, 390, 420, 450, 480]; // 4:00–8:00
const RETURN_MINUTES = [630, 660, 690, 780, 810, 840, 870, 900, 960, 1020, 1080]; // 10:30–18:00

/** In-memory TTL cache. A multi-instance deployment needs a shared cache (Redis/KV) here instead. */
const cache = new Map();

function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= Date.now()) {
    cache.delete(key);
    return null;
  }
  return entry.value;
}

function cacheSet(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS });
}

/** Local wall-clock time (America/Denver, DST-aware) → an RFC3339 UTC instant Google Routes accepts. */
function localToUtcIso(dateKey, minuteOfDay, timeZone) {
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

async function fetchWithTimeout(url, options, timeoutMs) {
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

async function buildTravelCurve(origin, destination, direction, date) {
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

/**
 * A single "right now" reading — one Google Routes call, no departure grid.
 * Exists for the mountain map, which only ever needs one point-in-time
 * duration/distance for whichever mountain the user actually tapped, never a
 * whole day's curve. Reusing `/api/travel-curve` for that would mean up to 9
 * extra Google calls per tap for numbers the UI throws away.
 */
async function fetchRoutePreview(origin, destination) {
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
          // No departureTime: Google reads that as "now", which is exactly
          // what a map preview means by traffic-aware.
        }),
      },
      REQUEST_TIMEOUT_MS,
    );
    if (!response.ok) return null;
    const data = await response.json();
    const route = data.routes?.[0];
    if (!route?.duration) return null;
    const seconds = Number(String(route.duration).replace('s', ''));
    if (!Number.isFinite(seconds)) return null;
    const distanceMeters = Number(route.distanceMeters);
    return {
      durationMinutes: Math.round(seconds / 60),
      distanceMiles: Number.isFinite(distanceMeters) ? Math.round((distanceMeters / 1609.344) * 10) / 10 : null,
    };
  } catch {
    return null;
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': CORS_ORIGIN,
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 1_000_000) req.destroy(new Error('Request body too large.'));
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function isPoint(value) {
  return value && typeof value.lat === 'number' && typeof value.lon === 'number';
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': CORS_ORIGIN,
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/api/health') {
    sendJson(res, 200, { ok: true, hasApiKey: API_KEY.length > 0, cacheSize: cache.size });
    return;
  }

  /*
   * Browser-friendly GET version of /api/travel-curve, for manually
   * eyeballing that a real deploy is actually returning live Google Routes
   * data (no POST client needed — just open the URL). Defaults to a fixed
   * Denver -> Copper Mountain outbound sample if no query params are given.
   * Not used by the app itself.
   */
  if (req.method === 'GET' && req.url?.startsWith('/api/test-drive')) {
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const origin = {
      lat: Number(params.get('originLat') ?? 39.7392),
      lon: Number(params.get('originLon') ?? -104.9903),
    };
    const destination = {
      lat: Number(params.get('destLat') ?? 39.4817),
      lon: Number(params.get('destLon') ?? -106.1614),
    };
    const direction = params.get('direction') === 'return' ? 'return' : 'outbound';
    const date = params.get('date') ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10);

    if (!API_KEY) {
      sendJson(res, 503, { error: 'GOOGLE_ROUTES_API_KEY is not configured on this server.' });
      return;
    }

    const curve = await buildTravelCurve(origin, destination, direction, date);
    if (!curve) {
      sendJson(res, 502, { error: 'No route data returned by Google Routes for any sampled departure time.' });
      return;
    }
    sendJson(res, 200, { origin, destination, direction, date, ...curve });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/route-preview') {
    if (!API_KEY) {
      sendJson(res, 503, {
        error: 'GOOGLE_ROUTES_API_KEY is not configured on this server. Set it and restart.',
      });
      return;
    }

    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { error: 'Malformed JSON body.' });
      return;
    }

    const { origin, destination } = body ?? {};
    if (!isPoint(origin) || !isPoint(destination)) {
      sendJson(res, 400, { error: 'origin and destination must each be { lat, lon }.' });
      return;
    }

    const cacheKey = [
      'preview',
      origin.lat.toFixed(3),
      origin.lon.toFixed(3),
      destination.lat.toFixed(3),
      destination.lon.toFixed(3),
    ].join(':');

    const cached = cacheGet(cacheKey);
    if (cached) {
      sendJson(res, 200, cached);
      return;
    }

    const preview = await fetchRoutePreview(origin, destination);
    if (!preview) {
      sendJson(res, 502, { error: 'No route returned by Google Routes.' });
      return;
    }

    cacheSet(cacheKey, preview);
    sendJson(res, 200, preview);
    return;
  }

  if (req.method === 'POST' && req.url === '/api/travel-curve') {
    if (!API_KEY) {
      sendJson(res, 503, {
        error: 'GOOGLE_ROUTES_API_KEY is not configured on this server. Set it and restart.',
      });
      return;
    }

    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch {
      sendJson(res, 400, { error: 'Malformed JSON body.' });
      return;
    }

    const { origin, destination, direction, date } = body ?? {};
    if (!isPoint(origin) || !isPoint(destination)) {
      sendJson(res, 400, { error: 'origin and destination must each be { lat, lon }.' });
      return;
    }
    if (direction !== 'outbound' && direction !== 'return') {
      sendJson(res, 400, { error: 'direction must be "outbound" or "return".' });
      return;
    }
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      sendJson(res, 400, { error: 'date must be "YYYY-MM-DD".' });
      return;
    }

    const cacheKey = [
      origin.lat.toFixed(3),
      origin.lon.toFixed(3),
      destination.lat.toFixed(3),
      destination.lon.toFixed(3),
      direction,
      date,
    ].join(':');

    const cached = cacheGet(cacheKey);
    if (cached) {
      sendJson(res, 200, cached);
      return;
    }

    const curve = await buildTravelCurve(origin, destination, direction, date);
    if (!curve) {
      sendJson(res, 502, { error: 'No route data returned by Google Routes for any sampled departure time.' });
      return;
    }

    cacheSet(cacheKey, curve);
    sendJson(res, 200, curve);
    return;
  }

  sendJson(res, 404, { error: 'Not found.' });
});

server.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(
    `SNOWNOW traffic proxy on :${PORT} — API key ${API_KEY ? 'present' : 'MISSING (requests will 503)'}`,
  );
});
