import { useMemo, useState } from 'react';
import type { RiderPreferences } from '@/config/weights';
import { resolveEnvironment } from '@/config/env';
import { MOUNTAINS, findMountain } from '@/data/mountains';
import { mountainProfileFor } from '@/data/mountainProfiles';
import { type Origin, routingDestinationFor } from '@/domain/mountain';
import { formatDuration } from '@/domain/time';
import { planSummary } from '@/engine/explain';
import { makeContext } from '@/engine/inputs';
import { planForMountain } from '@/engine/plan';
import { resolveAccessRoutes } from '@/engine/routing';
import { travelAt } from '@/engine/travel';
import { warmUpTrafficService } from '@/lib/warmup';
import { describeRoutePreviewFailure, fetchRoutePreview } from '@/providers/live/routePreview';
import type { ProviderRegistry } from '@/providers/types';
import type { ClockState } from '@/ui/hooks/useClock';
import { useAsync } from '@/ui/hooks/useRecommendation';
import { AlertBanner } from '@/ui/components/AlertBanner';
import { Caveats } from '@/ui/components/Caveats';
import { DataSources } from '@/ui/components/DataSources';
import { DepartureWhatIf } from '@/ui/components/DepartureWhatIf';
import { FactorBreakdown } from '@/ui/components/FactorBreakdown';
import { MountainMap, type MapRoutePreview } from '@/ui/components/MountainMap';
import { MountainProfilePanel } from '@/ui/components/MountainProfilePanel';
import { NavigateLinks } from '@/ui/components/NavigateLinks';
import { OriginPicker } from '@/ui/components/OriginPicker';
import { RecommendationCard } from '@/ui/components/RecommendationCard';
import { ReturnPlanner } from '@/ui/components/ReturnPlanner';
import { SnowClockPanel } from '@/ui/components/SnowClockPanel';
import { Timeline } from '@/ui/components/Timeline';
import { Wordmark } from '@/ui/components/Wordmark';

type RouteResult =
  | { kind: 'ok'; preview: MapRoutePreview }
  | { kind: 'unavailable'; message: string; likelySlowWake: boolean };

export interface MapScreenProps {
  registry: ProviderRegistry;
  clock: ClockState;
  origin: Origin;
  onOriginChange: (origin: Origin) => void;
  preferences: RiderPreferences;
  usingDemoData: boolean;
}

/**
 * The Colorado map is the front door of SNOWNOW — not a companion to a NOW/
 * LATER choice, the whole homepage. Tapping a mountain answers everything in
 * one place: how far it is right now, whether today is actually worth the
 * drive, and the reference details (trail map, tickets, parking) a person
 * needs before they leave the house.
 *
 * Two independent requests fire when a mountain is selected, each scoped to
 * that one mountain only — never the rest:
 *   1. A single "right now" route preview (fast, one network call).
 *   2. The full day plan (`planForMountain`) — the same engine NOW used to
 *      run, just no longer spent recomputing every mountain to throw away
 *      all but the one, because the map already did the choosing.
 */
export function MapScreen({ registry, clock, origin, onOriginChange, preferences, usingDemoData }: MapScreenProps) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showFactors, setShowFactors] = useState(false);
  const [showSources, setShowSources] = useState(false);
  const selectedMountain = selectedId ? (findMountain(selectedId) ?? null) : null;
  const apiBaseUrl = resolveEnvironment().trafficApiBaseUrl;
  // Only the dedicated single-call preview endpoint gets used in real live
  // mode — reusing the full day-curve pipeline here would cost up to 9 extra
  // Google Routes calls per tap for samples the map never shows. Demo mode
  // (and live mode with no traffic server configured) falls back to the
  // registry, which already handles both honestly and for free.
  // `apiBaseUrl` is `null` only when no traffic backend is configured at
  // all — `''` (same-origin) is a real, enabled value. See
  // `config/env.ts#SnownowEnvironment.trafficApiBaseUrl`.
  const useLivePreview = !registry.usingDemoData && apiBaseUrl != null;

  const selectMountain = (id: string) => {
    setSelectedId(id);
    setShowFactors(false);
    setShowSources(false);
    // The app-load warm-up (App.tsx) only helps a session that picks a
    // mountain quickly. Someone who lingers on the map first re-fires the
    // same fire-and-forget ping right as the real requests are about to go
    // out — a second head start, not a guarantee.
    warmUpTrafficService(apiBaseUrl);
  };

  const routeState = useAsync(
    async (): Promise<RouteResult | null> => {
      if (!selectedMountain) return null;
      const [route] = resolveAccessRoutes(selectedMountain, origin);
      if (!route) {
        return { kind: 'unavailable', message: 'No route known from this origin.', likelySlowWake: false };
      }

      if (useLivePreview) {
        try {
          // The live single-shot preview always targets the mountain's real
          // driving destination (base area / parking, when that differs from
          // the map-pin coordinate) — not whichever `destinationPoint` a
          // hand-authored demo route happened to be tuned to.
          // Non-null by construction: this branch only runs when
          // `useLivePreview` is true, which itself requires `apiBaseUrl` to
          // be non-null.
          const preview = await fetchRoutePreview(route.originPoint, routingDestinationFor(selectedMountain), apiBaseUrl!);
          return {
            kind: 'ok',
            preview: {
              durationMinutes: preview.durationMinutes,
              distanceMiles: preview.distanceMiles,
              trafficAware: true,
              routePoints: preview.routePoints,
            },
          };
        } catch (error) {
          const { message, likelySlowWake } = describeRoutePreviewFailure(error);
          return { kind: 'unavailable', message, likelySlowWake };
        }
      }

      const context = makeContext(clock.today, clock.today, clock.now);
      const availability = await registry.traffic.getTravelCurve(route, 'outbound', context);
      if (availability.status !== 'ok') {
        return { kind: 'unavailable', message: "Couldn't reach the route service.", likelySlowWake: false };
      }
      const curve = availability.data;
      const estimate = travelAt(curve, clock.now);
      return {
        kind: 'ok',
        preview: {
          durationMinutes: Math.round(estimate.durationMinutes),
          distanceMiles: curve.distanceMiles ?? route.distanceMiles ?? null,
          trafficAware: false,
          // The demo/day-curve path never has real road geometry — the map
          // draws an honestly-labelled approximate line instead of one.
          routePoints: null,
        },
      };
    },
    [selectedMountain?.id, origin.id, origin.coordinates.lat, origin.coordinates.lon, clock.today, clock.now, useLivePreview],
    { enabled: selectedMountain !== null },
  );

  const mapRoute = useMemo((): MapRoutePreview | 'loading' | 'error' | null => {
    if (!selectedMountain) return null;
    if (routeState.status === 'loading' || routeState.status === 'idle') return 'loading';
    if (routeState.status === 'error') return 'error';
    if (!routeState.data) return null;
    return routeState.data.kind === 'ok' ? routeState.data.preview : 'error';
  }, [selectedMountain, routeState]);

  // A friendly, honest reason — never a raw HTTP status or provider string.
  const failure =
    routeState.status === 'ready' && routeState.data?.kind === 'unavailable'
      ? routeState.data
      : routeState.status === 'error'
        ? { message: "Couldn't reach the route service.", likelySlowWake: false }
        : null;

  const planState = useAsync(
    () =>
      selectedMountain
        ? planForMountain(registry, {
            mountain: selectedMountain,
            origin,
            date: clock.today,
            today: clock.today,
            now: clock.now,
            preferences,
          })
        : Promise.resolve(null),
    [selectedMountain?.id, origin.id, origin.coordinates.lat, origin.coordinates.lon, clock.today, clock.now, preferences],
    { enabled: selectedMountain !== null, minimumMs: 900 },
  );

  if (selectedMountain) {
    return (
      <div className="screen mountainscreen">
        <header className="mountainscreen-head shell">
          <button type="button" className="mountainscreen-back" onClick={() => setSelectedId(null)}>
            <span aria-hidden="true">←</span> Map
          </button>
          <h1 className="mountainscreen-title">{selectedMountain.shortName}</h1>
        </header>

        <div className="screen-body shell stack mountainscreen-body">
          <MountainMap
            mountains={MOUNTAINS}
            origin={origin}
            selectedMountainId={selectedId}
            onSelectMountain={selectMountain}
            route={mapRoute}
            variant="compact"
          />

          <section className="panel mapscreen-route" aria-live="polite">
            <header className="panel-head">
              <h2 className="section-title mapscreen-route-title">Drive to {selectedMountain.shortName}</h2>
            </header>
            {mapRoute === 'loading' && <p className="faint">Checking the route…</p>}
            {mapRoute === 'error' && (
              <p className="mapscreen-route-error">
                Couldn't get a route right now. {failure?.message} We won't guess at a time or distance.
                {failure?.likelySlowWake && ' Give it a moment and try again.'}
              </p>
            )}
            {mapRoute && mapRoute !== 'loading' && mapRoute !== 'error' && (
              <dl className="mapscreen-route-stats">
                <div>
                  <dt>Drive time</dt>
                  <dd className="numeral">{formatDuration(mapRoute.durationMinutes)}</dd>
                </div>
                <div>
                  <dt>Distance</dt>
                  <dd className="numeral">
                    {mapRoute.distanceMiles != null ? `${Math.round(mapRoute.distanceMiles)} mi` : '—'}
                  </dd>
                </div>
                <div>
                  <dt>Traffic</dt>
                  <dd>{mapRoute.trafficAware ? 'Traffic-aware' : 'Demo estimate'}</dd>
                </div>
              </dl>
            )}
            {mapRoute && mapRoute !== 'loading' && mapRoute !== 'error' && (
              <NavigateLinks
                destination={routingDestinationFor(selectedMountain)}
                destinationLabel={selectedMountain.routingDestination?.label ?? selectedMountain.name}
                origin={origin.coordinates}
              />
            )}
          </section>

          {(planState.status === 'loading' || planState.status === 'idle') && (
            <p className="faint mapscreen-planloading" role="status">
              Checking the mountain, the snow and the roads…
            </p>
          )}

          {planState.status === 'error' && (
            <p className="mapscreen-route-error">
              Couldn't put together a full recommendation for {selectedMountain.shortName} right now.{' '}
              {planState.message}
            </p>
          )}

          {planState.status === 'ready' && planState.data && (
            <div className="stack mapscreen-plan">
              <p className="visually-hidden" role="status">
                {planSummary(planState.data)}
              </p>
              <AlertBanner alerts={planState.data.alerts} />
              <RecommendationCard plan={planState.data} />
              <SnowClockPanel
                clock={planState.data.snowClock}
                snowState={planState.data.snowState}
                firstTurn={planState.data.departure?.firstTurn ?? null}
                leaveAt={planState.data.return?.departure ?? null}
                now={planState.data.isToday ? clock.now : null}
              />
              <Timeline events={planState.data.timeline} />
              <DepartureWhatIf plan={planState.data} />
              <ReturnPlanner plan={planState.data} now={planState.data.isToday ? clock.now : null} />
            </div>
          )}

          <MountainProfilePanel mountain={selectedMountain} profile={mountainProfileFor(selectedMountain.id)} />

          {planState.status === 'ready' && planState.data && (
            <div className="stack mapscreen-plan">
              <section className="panel">
                <button
                  type="button"
                  className="disclosure"
                  onClick={() => setShowFactors((value) => !value)}
                  aria-expanded={showFactors}
                >
                  <span className="section-title">How we got {planState.data.score.score.toFixed(1)}</span>
                  <span aria-hidden="true">{showFactors ? '−' : '+'}</span>
                </button>
                {showFactors && <FactorBreakdown score={planState.data.score} />}
              </section>

              <section className="panel">
                <button
                  type="button"
                  className="disclosure"
                  onClick={() => setShowSources((value) => !value)}
                  aria-expanded={showSources}
                >
                  <span className="section-title">Where this data came from</span>
                  <span aria-hidden="true">{showSources ? '−' : '+'}</span>
                </button>
                {showSources && <DataSources sources={planState.data.dataSources} />}
              </section>

              <Caveats items={planState.data.caveats} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="screen maphome">
      <header className="maphome-head shell">
        <h1 className="maphome-brand">
          <Wordmark size="lg" />
        </h1>
        <p className="home-tagline maphome-tagline">{MOUNTAINS.length} Colorado peaks.. so far</p>
        {usingDemoData && (
          <p className="home-demo">
            No live weather, traffic or lift feeds are connected — every number below is
            simulated and labelled as such.
          </p>
        )}
        <div className="maphome-actions">
          <OriginPicker onChange={onOriginChange} />
          {usingDemoData ? (
            <span className="chip chip-demo">DEMO DATA</span>
          ) : (
            <span className="chip chip-live">LIVE</span>
          )}
        </div>
      </header>

      <div className="screen-body shell maphome-body">
        <MountainMap
          mountains={MOUNTAINS}
          origin={origin}
          selectedMountainId={null}
          onSelectMountain={selectMountain}
          route={null}
          variant="home"
        />
      </div>
    </div>
  );
}
