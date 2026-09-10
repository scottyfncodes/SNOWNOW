import { isManualCityOrigin } from '@/data/origins';
import { type AccessRoute, type Mountain, type Origin, routesFrom, routingDestinationFor } from '@/domain/mountain';
import { haversineMiles } from '@/lib/geo';

/**
 * The location/origin abstraction: turns *any* origin — one of the six
 * hand-authored manual cities, or a live GPS fix — into the same
 * `AccessRoute[]` shape every downstream consumer (`engine/inputs.ts`,
 * `engine/plan.ts`, both traffic providers) already knows how to route.
 * Neither caller needs to know which kind of origin it received.
 *
 * Manual cities keep their exact, unmodified pre-authored routes when one was
 * curated for that (mountain, city) pair — those carry real corridor/weather
 * modelling the demo curve uses. When a *real* mountain (one with genuine
 * routing data to at least some other city) has no hand-authored route from
 * a chosen city (a handful of far-flung resorts, e.g. Purgatory from
 * Denver), the same live-route fallback a GPS fix gets kicks in instead of
 * refusing to answer: a manual city has real, known coordinates too, and
 * every mountain on the map is meant to be reachable from wherever the user
 * says they're starting, not just the pairs someone happened to author by
 * hand. A mountain with no routing data at all stays unreachable — there is
 * nothing real to route to. Any origin that isn't one of the six cities —
 * above all a GPS coordinate — always gets the live route regardless; that's
 * also the one place a GPS fix could be snapped to a city instead of routed
 * from directly, and it isn't.
 */
export function resolveAccessRoutes(mountain: Mountain, origin: Origin): AccessRoute[] {
  if (isManualCityOrigin(origin.id)) {
    const authored = routesFrom(mountain, origin.id);
    if (authored.length > 0) return authored;
    return mountain.accessRoutes.length > 0 ? [buildLiveRoute(mountain, origin)] : [];
  }
  return [buildLiveRoute(mountain, origin)];
}

const AVERAGE_ROAD_SPEED_MPH = 45;
/** Straight-line distance underestimates real road distance; mountain roads wind more than this, but it's a starting figure only. */
const STRAIGHT_LINE_TO_ROAD_FACTOR = 1.2;
const DEFAULT_WEATHER_SENSITIVITY = 0.65;

/**
 * `freeFlowMinutes` / `stormPenaltyMinutes` / `weatherSensitivity` below feed
 * only the demo traffic provider's synthetic curve
 * (`providers/demo/traffic.ts`), which is always labelled DEMO DATA in the
 * UI. The live provider (`providers/live/googleRoutesTraffic.ts`) ignores
 * every one of them — it sends `originPoint`/`destinationPoint` straight to
 * Google Routes and reports back the real duration, traffic, and distance.
 */
function buildLiveRoute(mountain: Mountain, origin: Origin): AccessRoute {
  const destinationPoint = routingDestinationFor(mountain);
  const distanceMiles = haversineMiles(origin.coordinates, destinationPoint) * STRAIGHT_LINE_TO_ROAD_FACTOR;
  const primary = mountain.accessRoutes.find((route) => route.isPrimary) ?? mountain.accessRoutes[0];

  return {
    id: `${mountain.id}:${origin.id}:live`,
    originId: origin.id,
    label: `Live route from ${origin.shortName}`,
    corridorId: primary?.corridorId ?? 'local',
    originPoint: origin.coordinates,
    destinationPoint,
    distanceMiles,
    freeFlowMinutes: Math.round((distanceMiles / AVERAGE_ROAD_SPEED_MPH) * 60),
    stormPenaltyMinutes: Math.round(distanceMiles * 0.15),
    weatherSensitivity: primary?.weatherSensitivity ?? DEFAULT_WEATHER_SENSITIVITY,
    isPrimary: true,
  };
}
