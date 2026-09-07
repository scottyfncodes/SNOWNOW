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
  /** Base URL of the traffic proxy server. Empty = traffic stays demo. */
  trafficApiBaseUrl: string;
  /** Road-condition integration is unverified (see cotripRoad.ts) — opt-in. */
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
    trafficApiBaseUrl: typeof env.VITE_API_BASE_URL === 'string' ? env.VITE_API_BASE_URL : '',
    enableRoadConditions: env.VITE_ENABLE_ROAD_CONDITIONS === 'true',
  };
}
