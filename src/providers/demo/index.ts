import type { ProviderRegistry } from '@/providers/types';
import { DemoMountainProvider, type DemoMountainOptions } from './mountain';
import { DemoPlacesProvider } from './places';
import { DemoTrafficProvider, type DemoTrafficOptions } from './traffic';
import { DemoWeatherProvider, type DemoWeatherOptions } from './weather';

export * from './scenario';
export { DemoMountainProvider, DemoPlacesProvider, DemoTrafficProvider, DemoWeatherProvider };

export interface DemoRegistryOptions {
  weather?: DemoWeatherOptions;
  traffic?: DemoTrafficOptions;
  mountain?: DemoMountainOptions;
}

/**
 * The demo bundle. Swapping in a live provider is a one-line change here —
 * nothing above this layer knows which implementation it is talking to.
 */
export function createDemoRegistry(options: DemoRegistryOptions = {}): ProviderRegistry {
  return {
    weather: new DemoWeatherProvider(options.weather),
    traffic: new DemoTrafficProvider(options.traffic),
    mountain: new DemoMountainProvider(options.mountain),
    places: new DemoPlacesProvider(),
    usingDemoData: true,
    label: 'Demo data',
  };
}
