/**
 * Browser-friendly GET diagnostic — production counterpart of
 * `server/index.mjs`'s `/api/test-drive`. Open the URL directly to confirm a
 * real departure-time curve comes back. Not used by the app itself. Defaults
 * to a Denver -> Copper Mountain outbound sample for tomorrow.
 */
import { API_KEY, buildTravelCurve } from '../server/trafficCore.mjs';

export default async function handler(req, res) {
  const q = req.query ?? {};
  const origin = {
    lat: Number(q.originLat ?? 39.7392),
    lon: Number(q.originLon ?? -104.9903),
  };
  const destination = {
    lat: Number(q.destLat ?? 39.4817),
    lon: Number(q.destLon ?? -106.1614),
  };
  const direction = q.direction === 'return' ? 'return' : 'outbound';
  const date = q.date ?? new Date(Date.now() + 86400000).toISOString().slice(0, 10);

  if (!API_KEY) {
    res.status(503).json({
      error: 'MISSING_API_KEY',
      message: 'GOOGLE_ROUTES_API_KEY is not configured on this deployment.',
    });
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
  res.status(200).json({ origin, destination, direction, date, ...curve });
}
