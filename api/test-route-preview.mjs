/**
 * Browser-friendly GET diagnostic — production counterpart of
 * `server/index.mjs`'s `/api/test-route-preview`. Open the URL directly to
 * confirm Google Routes is really answering and really returning a
 * polyline. Not used by the app itself. Defaults to Denver -> Keystone.
 */
import { API_KEY, ROUTE_FETCH_ERROR_STATUS, RouteFetchError, fetchRoutePreview, logRouteFetchFailure } from '../server/trafficCore.mjs';

export default async function handler(req, res) {
  const q = req.query ?? {};
  const origin = {
    lat: Number(q.originLat ?? 39.7392),
    lon: Number(q.originLon ?? -104.9903),
  };
  const destination = {
    lat: Number(q.destLat ?? 39.6084),
    lon: Number(q.destLon ?? -105.9437),
  };

  if (!API_KEY) {
    res.status(503).json({
      error: 'MISSING_API_KEY',
      message: 'GOOGLE_ROUTES_API_KEY is not configured on this deployment.',
    });
    return;
  }

  try {
    const preview = await fetchRoutePreview(origin, destination);
    res.status(200).json({
      origin,
      destination,
      ...preview,
      hasPolyline: typeof preview.polyline === 'string' && preview.polyline.length > 0,
    });
  } catch (error) {
    if (error instanceof RouteFetchError) {
      res.status(ROUTE_FETCH_ERROR_STATUS[error.code] ?? 500).json({ error: error.code, message: error.message });
      return;
    }
    logRouteFetchFailure('unexpected /api/test-route-preview failure', error);
    res.status(500).json({ error: 'SERVER_ERROR', message: 'Unexpected server failure.' });
  }
}
