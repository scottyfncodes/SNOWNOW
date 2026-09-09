#!/usr/bin/env node
/**
 * SNOWNOW traffic proxy — local development only.
 *
 * Production traffic goes through Vercel serverless functions in `api/`
 * (same logic, see `server/trafficCore.mjs`, which both this file and those
 * functions import) — there is no long-running server in production
 * anymore. This file exists so `npm run server` + `npm run dev` still work
 * exactly as before for local development, without needing the Vercel CLI.
 *
 * Google Routes API does not serve CORS to browser requests carrying a key,
 * and even if it did, shipping a key in a static bundle hands it to anyone
 * who opens devtools — so this process (like the Vercel functions) holds the
 * real `GOOGLE_ROUTES_API_KEY` server-side and returns the client a plain
 * JSON travel curve with no secret anywhere in the response.
 *
 * Deliberately dependency-free (no Express): this is a small, single-purpose
 * proxy, not an application server, and a plain `node:http` router is easier
 * to audit for "does this leak the key anywhere" than a framework would be.
 *
 * Run: GOOGLE_ROUTES_API_KEY=... node server/index.mjs
 * See .env.example for every variable this reads.
 */
import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import {
  API_KEY,
  CORS_ORIGIN,
  ROUTE_FETCH_ERROR_STATUS,
  RouteFetchError,
  buildTravelCurve,
  cacheGet,
  cacheSet,
  cacheSize,
  fetchRoutePreview,
  isPoint,
  logRouteFetchFailure,
} from './trafficCore.mjs';

const PORT = Number(process.env.PORT ?? 8787);

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
    sendJson(res, 200, {
      ok: true,
      // `googleRoutesConfigured` is the name to check going forward;
      // `hasApiKey` stays for any existing caller that already reads it.
      googleRoutesConfigured: API_KEY.length > 0,
      hasApiKey: API_KEY.length > 0,
      cacheSize: cacheSize(),
      time: new Date().toISOString(),
    });
    return;
  }

  /*
   * Browser-friendly GET version of `/api/route-preview`, for manually
   * confirming in production — no POST client needed, just open the URL —
   * that Google Routes really is returning a route, and that the response
   * really does carry a polyline. Defaults to the exact case from this
   * project's own product requirement: Denver -> Keystone. Not used by the
   * app itself.
   */
  if (req.method === 'GET' && req.url?.startsWith('/api/test-route-preview')) {
    const params = new URL(req.url, `http://${req.headers.host}`).searchParams;
    const origin = {
      lat: Number(params.get('originLat') ?? 39.7392),
      lon: Number(params.get('originLon') ?? -104.9903),
    };
    const destination = {
      lat: Number(params.get('destLat') ?? 39.6084),
      lon: Number(params.get('destLon') ?? -105.9437),
    };

    if (!API_KEY) {
      sendJson(res, 503, {
        error: 'MISSING_API_KEY',
        message: 'GOOGLE_ROUTES_API_KEY is not configured on this server.',
      });
      return;
    }

    try {
      const preview = await fetchRoutePreview(origin, destination);
      sendJson(res, 200, {
        origin,
        destination,
        ...preview,
        hasPolyline: typeof preview.polyline === 'string' && preview.polyline.length > 0,
      });
    } catch (error) {
      if (error instanceof RouteFetchError) {
        sendJson(res, ROUTE_FETCH_ERROR_STATUS[error.code] ?? 500, { error: error.code, message: error.message });
        return;
      }
      logRouteFetchFailure('unexpected /api/test-route-preview failure', error);
      sendJson(res, 500, { error: 'SERVER_ERROR', message: 'Unexpected server failure.' });
    }
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
      sendJson(res, 503, {
        error: 'MISSING_API_KEY',
        message: 'GOOGLE_ROUTES_API_KEY is not configured on this server.',
      });
      return;
    }

    const curve = await buildTravelCurve(origin, destination, direction, date);
    if (!curve) {
      sendJson(res, 502, {
        error: 'NO_ROUTE_FOUND',
        message: 'Google Routes returned no route data for any sampled departure time.',
      });
      return;
    }
    sendJson(res, 200, { origin, destination, direction, date, ...curve });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/route-preview') {
    if (!API_KEY) {
      sendJson(res, 503, {
        error: 'MISSING_API_KEY',
        message: 'GOOGLE_ROUTES_API_KEY is not configured on this server. Set it and restart.',
      });
      return;
    }

    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (error) {
      logRouteFetchFailure('malformed JSON body on /api/route-preview', error);
      sendJson(res, 400, { error: 'MALFORMED_REQUEST', message: 'Malformed JSON body.' });
      return;
    }

    const { origin, destination } = body ?? {};
    if (!isPoint(origin) || !isPoint(destination)) {
      sendJson(res, 400, {
        error: 'MALFORMED_REQUEST',
        message: 'origin and destination must each be { lat, lon } with finite numbers.',
      });
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

    try {
      const preview = await fetchRoutePreview(origin, destination);
      cacheSet(cacheKey, preview);
      sendJson(res, 200, preview);
    } catch (error) {
      if (error instanceof RouteFetchError) {
        sendJson(res, ROUTE_FETCH_ERROR_STATUS[error.code] ?? 500, { error: error.code, message: error.message });
        return;
      }
      logRouteFetchFailure('unexpected /api/route-preview failure', error);
      sendJson(res, 500, { error: 'SERVER_ERROR', message: 'Unexpected server failure.' });
    }
    return;
  }

  if (req.method === 'POST' && req.url === '/api/travel-curve') {
    if (!API_KEY) {
      sendJson(res, 503, {
        error: 'MISSING_API_KEY',
        message: 'GOOGLE_ROUTES_API_KEY is not configured on this server. Set it and restart.',
      });
      return;
    }

    let body;
    try {
      body = JSON.parse(await readBody(req));
    } catch (error) {
      logRouteFetchFailure('malformed JSON body on /api/travel-curve', error);
      sendJson(res, 400, { error: 'MALFORMED_REQUEST', message: 'Malformed JSON body.' });
      return;
    }

    const { origin, destination, direction, date } = body ?? {};
    if (!isPoint(origin) || !isPoint(destination)) {
      sendJson(res, 400, {
        error: 'MALFORMED_REQUEST',
        message: 'origin and destination must each be { lat, lon } with finite numbers.',
      });
      return;
    }
    if (direction !== 'outbound' && direction !== 'return') {
      sendJson(res, 400, { error: 'MALFORMED_REQUEST', message: 'direction must be "outbound" or "return".' });
      return;
    }
    if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      sendJson(res, 400, { error: 'MALFORMED_REQUEST', message: 'date must be "YYYY-MM-DD".' });
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
      sendJson(res, 502, {
        error: 'NO_ROUTE_FOUND',
        message: 'Google Routes returned no route data for any sampled departure time.',
      });
      return;
    }

    cacheSet(cacheKey, curve);
    sendJson(res, 200, curve);
    return;
  }

  sendJson(res, 404, { error: 'NOT_FOUND', message: 'Not found.' });
});

/**
 * Only bind a real port when this file is actually run as the server
 * (`node server/index.mjs`, which is what `npm run server` does) — not when
 * it's `import`ed, which is what letting this file's own logic be
 * unit-tested requires. Without this guard, importing the module for a test
 * would silently bind a real OS port as a side effect of loading it.
 */
const isMainModule = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  server.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(
      `SNOWNOW local traffic proxy on :${PORT} — API key ${API_KEY ? 'present' : 'MISSING (requests will 503)'}`,
    );
  });
}

export { server, isPoint, fetchRoutePreview, RouteFetchError };
