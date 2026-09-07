import {
  DemoPlacesProvider,
  DemoPricingProvider,
  DemoRoadConditionProvider,
  DemoTrafficProvider,
} from '@/providers/demo';
import type { ProviderRegistry } from '@/providers/types';
import { CotripRoadProvider } from './cotripRoad';
import { LiveTrafficProvider } from './googleRoutesTraffic';
import { LiveMountainProvider } from './mountainStatus';
import { NwsAlertsProvider } from './nwsAlerts';
import { OpenMeteoWeatherProvider } from './openMeteoWeather';

export {
  CotripRoadProvider,
  LiveMountainProvider,
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
 * The live bundle. Ticket pricing and places have no reliable public
 * machine-readable source for arbitrary Colorado resorts — rather than
 * scrape fragile HTML, this deliberately keeps those two on the demo/static
 * implementations and says so (README → "Live Data Status"). Weather and
 * alerts are genuinely live; traffic is live only when a server base URL is
 * configured; road conditions are live-but-unverified and opt-in. Mountain
 * lift/terrain status has the same "no reliable API" problem as pricing, but
 * unlike pricing it reports `unavailable` rather than demo data — see
 * `mountainStatus.ts` for why. Its crowd forecast is a real (if coarse)
 * calendar-based heuristic, not a simulation.
 */
export function createLiveRegistry(options: LiveRegistryOptions = {}): ProviderRegistry {
  const hasTrafficServer = Boolean(options.trafficApiBaseUrl);

  return {
    weather: new OpenMeteoWeatherProvider(),
    traffic: hasTrafficServer
      ? new LiveTrafficProvider({ apiBaseUrl: options.trafficApiBaseUrl! })
      : new DemoTrafficProvider(),
    mountain: new LiveMountainProvider(),
    pricing: new DemoPricingProvider(),
    places: new DemoPlacesProvider(),
    alerts: new NwsAlertsProvider(),
    roads: options.enableRoadConditions ? new CotripRoadProvider() : new DemoRoadConditionProvider(),
    // "Any slot still demo" — true here because pricing/places always are,
    // and traffic/roads may be depending on configuration.
    usingDemoData: true,
    label: hasTrafficServer ? 'Live data (partial)' : 'Live weather, demo traffic',
  };
}
