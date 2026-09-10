// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Integration tests for the actual `node:http` server, not a re-description
 * of it: these start the real server (`server.listen(0)`, an ephemeral OS
 * port — the module-level `listen()` call is guarded off for exactly this,
 * see `isMainModule` in index.mjs) and drive it with real HTTP requests, the
 * same way the browser or `curl` would. Only the outbound call to Google's
 * Routes API is intercepted — everything else in the request/response path
 * (JSON parsing, validation, status codes, headers, caching) runs for real.
 *
 * `GOOGLE_ROUTES_API_KEY` and friends are read once, at module load, so each
 * test that needs a different key/config re-imports the module fresh after
 * `vi.resetModules()` — the only way to get a different top-level const.
 */

const REAL_FETCH = globalThis.fetch;
const ORIGINAL_ENV = { ...process.env };
let googleFetchMock;
let activeServer;

beforeEach(() => {
  googleFetchMock = vi.fn();
  vi.stubGlobal('fetch', (url, init) => {
    if (typeof url === 'string' && url.startsWith('https://routes.googleapis.com/')) {
      return googleFetchMock(url, init);
    }
    return REAL_FETCH(url, init);
  });
});

afterEach(async () => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
  process.env = { ...ORIGINAL_ENV };
  if (activeServer) {
    await new Promise((resolve) => activeServer.close(resolve));
    activeServer = undefined;
  }
});

async function freshServer(envOverrides = {}) {
  vi.resetModules();
  process.env = { ...ORIGINAL_ENV, ...envOverrides };
  const mod = await import('./index.mjs?' + Math.random());
  activeServer = mod.server;
  const port = await new Promise((resolve) => {
    mod.server.listen(0, '127.0.0.1', () => resolve(mod.server.address().port));
  });
  return { ...mod, port, baseUrl: `http://127.0.0.1:${port}` };
}

function googleOk({ durationSeconds = 3600, distanceMeters = 100_000, polyline = 'abc123' } = {}) {
  return new Response(
    JSON.stringify({
      routes: [
        {
          duration: `${durationSeconds}s`,
          distanceMeters,
          ...(polyline ? { polyline: { encodedPolyline: polyline } } : {}),
        },
      ],
    }),
    { status: 200 },
  );
}

async function postJson(baseUrl, path, body) {
  const res = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

// A real GPS-like fix — not one of the six manual cities' coordinates —
// exercising exactly the path the product requirement cares about: an
// arbitrary origin reaching the server, reaching Google, and a real
// destination (Keystone) coming back with duration, distance and a polyline.
const GPS_ORIGIN = { lat: 39.7392, lon: -104.9903 };
const KEYSTONE = { lat: 39.6084, lon: -105.9437 };

describe('POST /api/route-preview', () => {
  it('returns a structured 503 when the API key is missing, never a fabricated route', async () => {
    const { baseUrl } = await freshServer({ GOOGLE_ROUTES_API_KEY: '' });
    const { status, json } = await postJson(baseUrl, '/api/route-preview', {
      origin: GPS_ORIGIN,
      destination: KEYSTONE,
    });
    expect(status).toBe(503);
    expect(json).toEqual({ error: 'MISSING_API_KEY', message: expect.any(String) });
  });

  it('returns a structured 400 on malformed JSON', async () => {
    const { baseUrl } = await freshServer({ GOOGLE_ROUTES_API_KEY: 'test-key' });
    const { status, json } = await postJson(baseUrl, '/api/route-preview', '{not json');
    expect(status).toBe(400);
    expect(json).toEqual({ error: 'MALFORMED_REQUEST', message: expect.any(String) });
  });

  it('returns a structured 400 on invalid coordinates', async () => {
    const { baseUrl } = await freshServer({ GOOGLE_ROUTES_API_KEY: 'test-key' });
    const { status, json } = await postJson(baseUrl, '/api/route-preview', {
      origin: { lat: 'north', lon: -105 },
      destination: KEYSTONE,
    });
    expect(status).toBe(400);
    expect(json.error).toBe('MALFORMED_REQUEST');
  });

  it('returns a structured 502 when Google rejects the request', async () => {
    googleFetchMock.mockResolvedValue(new Response(JSON.stringify({ error: 'bad request' }), { status: 400 }));
    const { baseUrl } = await freshServer({ GOOGLE_ROUTES_API_KEY: 'test-key' });
    const { status, json } = await postJson(baseUrl, '/api/route-preview', {
      origin: GPS_ORIGIN,
      destination: KEYSTONE,
    });
    expect(status).toBe(502);
    expect(json).toEqual({ error: 'GOOGLE_ROUTES_ERROR', message: expect.any(String) });
  });

  it('returns a structured 502 when Google responds ok but with no usable route', async () => {
    googleFetchMock.mockResolvedValue(new Response(JSON.stringify({ routes: [] }), { status: 200 }));
    const { baseUrl } = await freshServer({ GOOGLE_ROUTES_API_KEY: 'test-key' });
    const { status, json } = await postJson(baseUrl, '/api/route-preview', {
      origin: GPS_ORIGIN,
      destination: KEYSTONE,
    });
    expect(status).toBe(502);
    expect(json).toEqual({ error: 'NO_ROUTE_FOUND', message: expect.any(String) });
  });

  it('returns a structured 500 when the network call itself throws, never a fabricated route', async () => {
    googleFetchMock.mockRejectedValue(new Error('DNS lookup failed'));
    const { baseUrl } = await freshServer({ GOOGLE_ROUTES_API_KEY: 'test-key' });
    const { status, json } = await postJson(baseUrl, '/api/route-preview', {
      origin: GPS_ORIGIN,
      destination: KEYSTONE,
    });
    expect(status).toBe(500);
    expect(json).toEqual({ error: 'SERVER_ERROR', message: expect.any(String) });
  });

  it('an arbitrary GPS-like origin reaches Google exactly as-is, and the real duration/distance/polyline come back', async () => {
    googleFetchMock.mockResolvedValue(googleOk({ durationSeconds: 5400, distanceMeters: 112_654, polyline: 'realPolylineData' }));
    const { baseUrl } = await freshServer({ GOOGLE_ROUTES_API_KEY: 'test-key' });

    const { status, json } = await postJson(baseUrl, '/api/route-preview', {
      origin: GPS_ORIGIN,
      destination: KEYSTONE,
    });

    expect(status).toBe(200);
    expect(json).toEqual({ durationMinutes: 90, distanceMiles: 70, polyline: 'realPolylineData' });

    // The exact GPS coordinates — not a snapped or rounded city — actually
    // reached Google's request body.
    expect(googleFetchMock).toHaveBeenCalledTimes(1);
    const [, init] = googleFetchMock.mock.calls[0];
    const sentBody = JSON.parse(init.body);
    expect(sentBody.origin.location.latLng).toEqual({ latitude: GPS_ORIGIN.lat, longitude: GPS_ORIGIN.lon });
    expect(sentBody.destination.location.latLng).toEqual({ latitude: KEYSTONE.lat, longitude: KEYSTONE.lon });
    expect(sentBody.travelMode).toBe('DRIVE');
    expect(sentBody.routingPreference).toBe('TRAFFIC_AWARE');
    expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
    expect(init.headers['X-Goog-FieldMask']).toContain('routes.polyline.encodedPolyline');
    // The key must never appear in the body sent to Google, only the header.
    expect(init.body).not.toContain('test-key');
  });

  it('never leaks the API key in an error response', async () => {
    googleFetchMock.mockResolvedValue(new Response('unauthorized', { status: 403 }));
    const { baseUrl } = await freshServer({ GOOGLE_ROUTES_API_KEY: 'super-secret-key' });
    const { json } = await postJson(baseUrl, '/api/route-preview', { origin: GPS_ORIGIN, destination: KEYSTONE });
    expect(JSON.stringify(json)).not.toContain('super-secret-key');
  });

  it('caches identical requests instead of calling Google twice', async () => {
    googleFetchMock.mockResolvedValue(googleOk());
    const { baseUrl } = await freshServer({ GOOGLE_ROUTES_API_KEY: 'test-key' });
    await postJson(baseUrl, '/api/route-preview', { origin: GPS_ORIGIN, destination: KEYSTONE });
    await postJson(baseUrl, '/api/route-preview', { origin: GPS_ORIGIN, destination: KEYSTONE });
    expect(googleFetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('GET /api/health', () => {
  it('reports googleRoutesConfigured without ever exposing the key itself', async () => {
    const { baseUrl } = await freshServer({ GOOGLE_ROUTES_API_KEY: 'super-secret-key' });
    const res = await fetch(`${baseUrl}/api/health`);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.googleRoutesConfigured).toBe(true);
    expect(JSON.stringify(json)).not.toContain('super-secret-key');
  });

  it('reports googleRoutesConfigured: false when no key is set', async () => {
    const { baseUrl } = await freshServer({ GOOGLE_ROUTES_API_KEY: '' });
    const res = await fetch(`${baseUrl}/api/health`);
    const json = await res.json();
    expect(json.googleRoutesConfigured).toBe(false);
  });
});

describe('GET /api/test-route-preview', () => {
  it('defaults to Denver -> Keystone and reports whether a polyline came back', async () => {
    googleFetchMock.mockResolvedValue(googleOk({ polyline: 'somePolyline' }));
    const { baseUrl } = await freshServer({ GOOGLE_ROUTES_API_KEY: 'test-key' });
    const res = await fetch(`${baseUrl}/api/test-route-preview`);
    const json = await res.json();
    expect(res.status).toBe(200);
    expect(json.destination).toEqual(KEYSTONE);
    expect(json.hasPolyline).toBe(true);
  });

  it('reports hasPolyline: false honestly when Google returns no polyline', async () => {
    googleFetchMock.mockResolvedValue(googleOk({ polyline: null }));
    const { baseUrl } = await freshServer({ GOOGLE_ROUTES_API_KEY: 'test-key' });
    const res = await fetch(`${baseUrl}/api/test-route-preview`);
    const json = await res.json();
    expect(json.hasPolyline).toBe(false);
    expect(json.polyline).toBeNull();
  });
});

describe('fetchRoutePreview — direct unit coverage of the Google-call classification', () => {
  it('throws TIMEOUT when the request is aborted', async () => {
    vi.useFakeTimers();
    const { fetchRoutePreview } = await freshServer({ GOOGLE_ROUTES_API_KEY: 'test-key' });
    googleFetchMock.mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init.signal.addEventListener('abort', () => {
            const err = new Error('aborted');
            err.name = 'AbortError';
            reject(err);
          });
        }),
    );
    const pending = fetchRoutePreview(GPS_ORIGIN, KEYSTONE);
    const assertion = expect(pending).rejects.toMatchObject({ code: 'TIMEOUT' });
    await vi.advanceTimersByTimeAsync(6000);
    await assertion;
  });
});
