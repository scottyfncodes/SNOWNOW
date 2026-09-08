import type { ProviderRegistry } from '@/providers/types';
import { CotripRoadProvider } from './cotripRoad';
import { LiveTrafficProvider } from './googleRoutesTraffic';
import { LiveMountainProvider } from './mountainStatus';
import { NwsAlertsProvider } from './nwsAlerts';
import { OpenMeteoWeatherProvider } from './openMeteoWeather';
import { LiveParkingProvider } from './parking';
import { LivePricingProvider } from './pricing';
import {
  UnavailablePlacesProvider,
  UnavailableRoadConditionProvider,
  UnavailableTrafficProvider,
} from './unavailable';

export {
  CotripRoadProvider,
  LiveMountainProvider,
  LiveParkingProvider,
  LivePricingProvider,
  LiveTrafficProvider,
  NwsAlertsProvider,
  OpenMeteoWeatherProvider,
};

export interface LiveRegistryOptions {
  /** Base URL of the traffic proxy server (see `server/index.mjs`). */
  trafficApiBaseUrl?: string;
  /** CDOT/COtrip road conditions — on by default, see `config/env.ts`. */
  enableRoadConditions?: boolean;
}

/**
 * The live bundle — the production data gate.
 *
 * Nothing this module reaches ever imports `providers/demo`. Every slot is
 * either a genuine live call or an `Unavailable*Provider` from
 * `./unavailable.ts` that reports `unavailable` honestly — there is no
 * config-time *or* request-time path from this registry to a demo value.
 * `places` has no live implementation and was never in scope for one; it
 * reports `unavailable` the same as an unconfigured slot, not demo data.
 *
 * | Slot | Live when | Otherwise |
 * |---|---|---|
 * | weather, alerts | always | (no fallback — these have no config knob) |
 * | traffic | `trafficApiBaseUrl` set | `unavailable` |
 * | roads | `enableRoadConditions` (default true) | `unavailable` |
 * | mountain (operations) | Liftie covers the resort | `unavailable` |
 * | mountain (crowds) | never — retired, see `mountainStatus.ts` | `unavailable` |
 * | pricing | never — no verifiable source, see `pricing.ts` | `unavailable` |
 * | parking | always, for a researched mountain — see `parking.ts` | `unavailable` for an unresearched mountain |
 * | places | never — no live implementation | `unavailable` |
 *
 * `createProviderRegistry` (`providers/index.ts`) is the only caller; its
 * own test (`providers/index.test.ts`) asserts that a live-mode registry
 * never returns a `Demo*Provider` instance in any slot.
 */
export function createLiveRegistry(options: LiveRegistryOptions = {}): ProviderRegistry {
  const hasTrafficServer = Boolean(options.trafficApiBaseUrl);
  const roadConditionsEnabled = options.enableRoadConditions ?? true;

  return {
    weather: new OpenMeteoWeatherProvider(),
    traffic: hasTrafficServer
      ? new LiveTrafficProvider({ apiBaseUrl: options.trafficApiBaseUrl! })
      : new UnavailableTrafficProvider(),
    mountain: new LiveMountainProvider(),
    pricing: new LivePricingProvider(),
    places: new UnavailablePlacesProvider(),
    alerts: new NwsAlertsProvider(),
    roads: roadConditionsEnabled ? new CotripRoadProvider() : new UnavailableRoadConditionProvider(),
    parking: new LiveParkingProvider(),
    // No slot in this registry is ever a demo implementation — a config-time
    // gap reports `unavailable`, not demo data. See the module docblock.
    usingDemoData: false,
    label: hasTrafficServer ? 'Live data' : 'Live data (traffic unavailable — no server configured)',
  };
}
