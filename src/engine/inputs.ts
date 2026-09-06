import type { CrowdCurve, MountainWeather, OperationsReport, TravelCurve } from '@/domain/conditions';
import type { DateKey } from '@/domain/dates';
import { daysBetween } from '@/domain/dates';
import { type AccessRoute, type Mountain, type Origin, routesFrom } from '@/domain/mountain';
import { type Availability, unavailable } from '@/domain/provenance';
import type { MinuteOfDay } from '@/domain/time';
import type { ProviderContext, ProviderRegistry } from '@/providers/types';
import { bestCurve } from './travel';

/**
 * Everything the engine needs about one mountain on one day, with each piece
 * independently allowed to be missing. A dead lift-status feed lowers our
 * confidence; it does not take the whole recommendation down.
 */
export interface DayInputs {
  mountain: Mountain;
  origin: Origin;
  date: DateKey;
  horizonDays: number;
  isToday: boolean;
  weather: Availability<MountainWeather>;
  operations: Availability<OperationsReport>;
  crowds: Availability<CrowdCurve>;
  outbound: Availability<TravelCurve>;
  inbound: Availability<TravelCurve>;
  /** Every route considered, so the UI can talk about alternatives. */
  outboundOptions: TravelCurve[];
  inboundOptions: TravelCurve[];
  routes: AccessRoute[];
  usingDemoData: boolean;
}

export function makeContext(date: DateKey, today: DateKey, now: MinuteOfDay): ProviderContext {
  return { date, today, now, horizonDays: Math.max(0, daysBetween(today, date)) };
}

/** Provider calls are wrapped so a thrown error becomes an honest empty state. */
async function attempt<T>(
  providerId: string,
  run: () => Promise<Availability<T>>,
): Promise<Availability<T>> {
  try {
    return await run();
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Provider request failed.';
    return unavailable<T>(providerId, reason);
  }
}

export async function loadDayInputs(
  registry: ProviderRegistry,
  mountain: Mountain,
  origin: Origin,
  context: ProviderContext,
): Promise<DayInputs> {
  const routes = routesFrom(mountain, origin.id);

  const [weather, operations, crowds, outboundResults, inboundResults] = await Promise.all([
    attempt(registry.weather.id, () => registry.weather.getMountainWeather(mountain, context)),
    attempt(registry.mountain.id, () => registry.mountain.getOperations(mountain, context)),
    attempt(registry.mountain.id, () => registry.mountain.getCrowdForecast(mountain, context)),
    Promise.all(
      routes.map((route) =>
        attempt(registry.traffic.id, () => registry.traffic.getTravelCurve(route, 'outbound', context)),
      ),
    ),
    Promise.all(
      routes.map((route) =>
        attempt(registry.traffic.id, () => registry.traffic.getTravelCurve(route, 'return', context)),
      ),
    ),
  ]);

  const outboundOptions = outboundResults.flatMap((r) => (r.status === 'ok' ? [r.data] : []));
  const inboundOptions = inboundResults.flatMap((r) => (r.status === 'ok' ? [r.data] : []));

  const pickBest = (
    options: TravelCurve[],
    results: Availability<TravelCurve>[],
  ): Availability<TravelCurve> => {
    const chosen = bestCurve(options);
    if (chosen) {
      const match = results.find((r) => r.status === 'ok' && r.data.routeId === chosen.routeId);
      if (match && match.status === 'ok') return match;
    }
    const firstFailure = results.find((r) => r.status === 'unavailable');
    return (
      firstFailure ??
      unavailable<TravelCurve>(registry.traffic.id, 'No drivable route from this starting point.')
    );
  };

  return {
    mountain,
    origin,
    date: context.date,
    horizonDays: context.horizonDays,
    isToday: context.horizonDays === 0,
    weather,
    operations,
    crowds,
    outbound: pickBest(outboundOptions, outboundResults),
    inbound: pickBest(inboundOptions, inboundResults),
    outboundOptions,
    inboundOptions,
    routes,
    usingDemoData: registry.usingDemoData,
  };
}
