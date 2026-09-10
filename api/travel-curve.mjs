/**
 * Vercel serverless function — production counterpart of `server/index.mjs`'s
 * `/api/travel-curve` route. See `api/route-preview.mjs`'s docblock for why
 * this is a thin adapter over `server/trafficCore.mjs`, not a second copy.
 */
import { CORS_ORIGIN, API_KEY, buildTravelCurve, cacheGet, cacheSet, isPoint } from '../server/trafficCore.mjs';

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
  const { origin, destination, direction, date } = body;
  if (!isPoint(origin) || !isPoint(destination)) {
    res.status(400).json({
      error: 'MALFORMED_REQUEST',
      message: 'origin and destination must each be { lat, lon } with finite numbers.',
    });
    return;
  }
  if (direction !== 'outbound' && direction !== 'return') {
    res.status(400).json({ error: 'MALFORMED_REQUEST', message: 'direction must be "outbound" or "return".' });
    return;
  }
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    res.status(400).json({ error: 'MALFORMED_REQUEST', message: 'date must be "YYYY-MM-DD".' });
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
    res.status(200).json(cached);
    return;
  }

  const curve = await buildTravelCurve(origin, destination, direction, date);
  if (!curve) {
    res.status(502).json({
      error: 'NO_ROUTE_FOUND',
      message: 'Google Routes returned no route data for any sampled departure time.',
    });
    return;
  }

  cacheSet(cacheKey, curve);
  res.status(200).json(curve);
}
