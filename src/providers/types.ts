import type { DateKey } from '@/domain/dates';
import type {
  CrowdCurve,
  MountainWeather,
  OperationsReport,
  TravelCurve,
} from '@/domain/conditions';
import type { AccessRoute, Mountain, Origin } from '@/domain/mountain';
import type { TicketPrice } from '@/domain/pricing';
import type { Availability } from '@/domain/provenance';
import type { MinuteOfDay } from '@/domain/time';

/**
 * Everything a provider needs to answer for a specific day. Providers are
 * pure request/response: they never reach into app state, and the UI never
 * reaches past them into a vendor SDK.
 */
export interface ProviderContext {
  /** The day being planned. */
  date: DateKey;
  /** The real "today", so providers can tell live from forecast. */
  today: DateKey;
  /** Wall-clock minute of `today`. Only meaningful when date === today. */
  now: MinuteOfDay;
  /** Days ahead of today (0 = today). Derived, but passed for convenience. */
  horizonDays: number;
}

export interface WeatherProvider {
  readonly id: string;
  getMountainWeather(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<MountainWeather>>;
}

export interface TrafficProvider {
  readonly id: string;
  /**
   * Departure-time-dependent travel along a route. `direction` matters:
   * the morning and afternoon congestion profiles are not mirror images.
   */
  getTravelCurve(
    route: AccessRoute,
    direction: 'outbound' | 'return',
    context: ProviderContext,
  ): Promise<Availability<TravelCurve>>;
}

export interface MountainProvider {
  readonly id: string;
  getOperations(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<OperationsReport>>;
  getCrowdForecast(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<CrowdCurve>>;
}

/**
 * Ticket pricing is its own upstream: a resort's commerce system has nothing
 * to do with its lift-status feed, and one will go live long before the other.
 * Keeping it behind its own interface means a real pricing integration lands
 * without touching the UI or the optimiser.
 */
export interface PricingProvider {
  readonly id: string;
  getTicketPrice(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<TicketPrice>>;
}

export type PlaceKind =
  | 'coffee'
  | 'breakfast'
  | 'gas'
  | 'lunch'
  | 'apres'
  | 'dinner'
  | 'lodging';

export interface Place {
  id: string;
  name: string;
  kind: PlaceKind;
  /** Where it sits in the day: on the way up, at the mountain, on the way home. */
  leg: 'outbound' | 'mountain' | 'return';
  detourMinutes: number;
  note: string;
}

/**
 * Après / fuel stops are downstream of the ski-day call, never the point of it.
 * The interface exists so the day ecosystem can grow without reshaping the core.
 */
export interface PlacesProvider {
  readonly id: string;
  getPlaces(
    mountain: Mountain,
    origin: Origin,
    kinds: PlaceKind[],
    context: ProviderContext,
  ): Promise<Availability<Place[]>>;
}

export interface ProviderRegistry {
  weather: WeatherProvider;
  traffic: TrafficProvider;
  mountain: MountainProvider;
  pricing: PricingProvider;
  places: PlacesProvider;
  /** True when any provider in the bundle is serving demo data. */
  usingDemoData: boolean;
  label: string;
}
