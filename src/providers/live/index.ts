import { DemoPlacesProvider, DemoRoadConditionProvider, DemoTrafficProvider } from '@/providers/demo';
import type { ProviderRegistry } from '@/providers/types';
import { CotripRoadProvider } from './cotripRoad';
import { LiveTrafficProvider } from './googleRoutesTraffic';
import { LiveMountainProvider } from './mountainStatus';
import { NwsAlertsProvider } from './nwsAlerts';
import { OpenMeteoWeatherProvider } from './openMeteoWeather';
import { LivePricingProvider } from './pricing';

export {
  CotripRoadProvider,
  LiveMountainProvider,
  LivePricingProvider,
  LiveTrafficProvider,
  NwsAlertsProvider,
  OpenMeteoWeatherProvider,
};

export interface LiveRegistryOptions {
  /**
   * Base URL of the traffic proxy server (see `server/index.mjs`). If unset,
   * traffic falls back to the demo provider — never to a fabricated live
   * number, and never to a browser call carrying a secret. This is a
   * config-time choice, made once when the registry is assembled; it is
   * distinct from a live request *failing*, which always surfaces as
   * `unavailable`, never as a silent demo substitution.
   */
  trafficApiBaseUrl?: string;
  /** Road conditions are best-effort/unverified (see cotripRoad.ts). Off by default. */
  enableRoadConditions?: boolean;
}

/**
 * The live bundle. `places` (après suggestions) is the one slot with no live
 * path at all and stays demo/static, said so in the README. Everything else
 * is live or live-with-honest-fallback: weather and alerts unconditionally;
 * traffic when a server base URL is configured, demo otherwise; road
 * conditions live-but-unverified and opt-in; mountain operations tries
 * Liftie and reports `unavailable` rather than demo data when it can't (see
 * `mountainStatus.ts`); pricing reports `unavailable` for every resort after
 * a real investigation found no verifiable live source (see `pricing.ts`) —
 * never the demo model's plausible number presented as live. Its crowd
 * forecast is a real (if coarse) calendar-based heuristic, not a simulation.
 */
export function createLiveRegistry(options: LiveRegistryOptions = {}): ProviderRegistry {
  const hasTrafficServer = Boolean(options.trafficApiBaseUrl);

  return {
    weather: new OpenMeteoWeatherProvider(),
    traffic: hasTrafficServer
      ? new LiveTrafficProvider({ apiBaseUrl: options.trafficApiBaseUrl! })
      : new DemoTrafficProvider(),
    mountain: new LiveMountainProvider(),
    pricing: new LivePricingProvider(),
    places: new DemoPlacesProvider(),
    alerts: new NwsAlertsProvider(),
    roads: options.enableRoadConditions ? new CotripRoadProvider() : new DemoRoadConditionProvider(),
    // "Any slot still demo" — true here only because `places` always is, and
    // `traffic`/`roads` may be depending on configuration.
    usingDemoData: true,
    label: hasTrafficServer ? 'Live data (partial)' : 'Live weather, demo traffic',
  };
}
