import type { SnownowEnvironment } from '@/config/env';
import { resolveEnvironment } from '@/config/env';
import { createDemoRegistry } from './demo';
import { createLiveRegistry } from './live';
import type { ProviderRegistry } from './types';

/**
 * The single line `App.tsx` calls. Everything above this file works against
 * `ProviderRegistry` and has no idea whether that came from demo data, a real
 * forecast, or some mix — that boundary is the whole architecture.
 *
 * The default, with no environment configured at all, is demo mode. Live mode
 * has to be asked for explicitly (`VITE_DATA_MODE=live` at build time — Vite
 * bakes `import.meta.env` in at build, so switching modes means a rebuild,
 * not a runtime toggle); this is what makes demo mode "safe" in the sense the
 * real-data gate asks for: there is no way to end up live by accident.
 */
export function createProviderRegistry(env: SnownowEnvironment = resolveEnvironment()): ProviderRegistry {
  if (env.dataMode === 'demo') return createDemoRegistry();
  return createLiveRegistry({
    // `null` (not configured) becomes `undefined` here; `''` (same-origin)
    // passes through as a real, configured value. See
    // `config/env.ts#SnownowEnvironment.trafficApiBaseUrl`.
    trafficApiBaseUrl: env.trafficApiBaseUrl ?? undefined,
    enableRoadConditions: env.enableRoadConditions,
  });
}

export { createDemoRegistry, createLiveRegistry };
export type { ProviderRegistry };
