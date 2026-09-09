/**
 * Vercel serverless function — production counterpart of `server/index.mjs`'s
 * `/api/route-preview` route. Same logic (`server/trafficCore.mjs`), a
 * different thin adapter: Vercel already parses the JSON body onto
 * `req.body` and gives us `res.status(...).json(...)`, so this file is only
 * the HTTP-shape wiring, never a second copy of the Google Routes logic.
 */
import {
  CORS_ORIGIN,
  ROUTE_FETCH_ERROR_STATUS,
  RouteFetchError,
  API_KEY,
  cacheGet,
  cacheSet,
  fetchRoutePreview,
  isPoint,
  logRouteFetchFailure,
} from '../server/trafficCore.mjs';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', CORS_ORIGIN);
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.status(204).end();
    return;
  }
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'METHOD_NOT_ALLOWED', message: 'Use POST.' });
    return;
  }

  if (!API_KEY) {
    res.status(503).json({
      error: 'MISSING_API_KEY',
      message: 'GOOGLE_ROUTES_API_KEY is not configured on this deployment.',
    });
    return;
  }

  const body = req.body ?? {};
  const { origin, destination } = body;
  if (!isPoint(origin) || !isPoint(destination)) {
    res.status(400).json({
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
    res.status(200).json(cached);
    return;
  }

  try {
    const preview = await fetchRoutePreview(origin, destination);
    cacheSet(cacheKey, preview);
    res.status(200).json(preview);
  } catch (error) {
    if (error instanceof RouteFetchError) {
      res.status(ROUTE_FETCH_ERROR_STATUS[error.code] ?? 500).json({ error: error.code, message: error.message });
      return;
    }
    logRouteFetchFailure('unexpected /api/route-preview failure', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Unexpected server failure.' });
  }
}
