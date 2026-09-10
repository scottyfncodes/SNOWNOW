/**
 * The one place that reads `import.meta.env`. Every other module asks this
 * file for a resolved, typed answer instead of reaching into Vite's env
 * object directly — which is what makes "no keys in the bundle" checkable by
 * inspection: secrets can only leak through here, and nothing here reads one.
 *
 * All three variables are plain configuration, safe to ship in a public
 * bundle (a base URL is not a credential). Absence of every one of them is
 * the supported, default state: SNOWNOW runs in demo mode with zero
 * environment setup, which is what "safe demo mode when keys are absent"
 * requires.
 */
export type DataMode = 'demo' | 'live';

export interface SnownowEnvironment {
  dataMode: DataMode;
  /**
   * Base URL to prefix onto traffic-proxy requests.
   *
   * `null` — no traffic backend configured; live mode reports traffic
   * `unavailable` rather than reaching for one. `''` (empty string, not
   * absent) — same-origin: the proxy is this same deployment's own `/api/*`
   * serverless functions (see `api/route-preview.mjs`, `api/travel-curve.mjs`
   * — this is what production actually runs on Vercel). A non-empty absolute
   * URL points at an external proxy, e.g. `http://localhost:8787` for local
   * dev against `npm run server`.
   *
   * The `null` vs `''` distinction is deliberate and load-bearing: both used
   * to collapse to the same falsy empty string, which made "not configured"
   * indistinguishable from "configured, same origin" — exactly the bug that
   * made this a two-value type instead of one.
   */
  trafficApiBaseUrl: string | null;
  /**
   * CDOT/COtrip road conditions. On by default in live mode — the provider
   * fails safe (`unavailable`) on any response it doesn't recognize, so
   * there's no honesty cost to attempting it; set to "false" to disable
   * outright rather than to opt in. See `cotripRoad.ts` for the still-open
   * verification caveat (this sandbox cannot reach the real endpoint).
   */
  enableRoadConditions: boolean;
}

function readEnv(): Record<string, string | boolean | undefined> {
  try {
    // import.meta.env is statically replaced at build time by Vite; this
    // still works correctly under Vitest, which implements the same API.
    return import.meta.env as unknown as Record<string, string | boolean | undefined>;
  } catch {
    return {};
  }
}

export function resolveEnvironment(): SnownowEnvironment {
  const env = readEnv();
  const dataMode = env.VITE_DATA_MODE === 'live' ? 'live' : 'demo';
  return {
    dataMode,
    trafficApiBaseUrl: typeof env.VITE_API_BASE_URL === 'string' ? env.VITE_API_BASE_URL : null,
    enableRoadConditions: env.VITE_ENABLE_ROAD_CONDITIONS !== 'false',
  };
}
