import { useEffect, useMemo, useRef } from 'react';
import L from 'leaflet';
import 'leaflet.markercluster';
import { MapContainer, Marker, Polyline, TileLayer, Tooltip, useMap } from 'react-leaflet';
import type { GeoPoint, Mountain, Origin } from '@/domain/mountain';
import 'leaflet/dist/leaflet.css';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

export interface MapRoutePreview {
  durationMinutes: number;
  distanceMiles: number | null;
  trafficAware: boolean;
  /**
   * The real driven road geometry, decoded from Google's polyline. `null`
   * when no real geometry is available (demo mode, or a live proxy that
   * didn't return one) — the map then draws a clearly-marked approximate
   * direction line instead of pretending it's the actual road.
   */
  routePoints: GeoPoint[] | null;
}

export interface MountainMapProps {
  mountains: Mountain[];
  origin: Origin;
  selectedMountainId: string | null;
  onSelectMountain: (mountainId: string) => void;
  /** `null` while nothing is selected or the route hasn't resolved; `'error'` when routing genuinely failed — never a guessed number. */
  route?: MapRoutePreview | 'loading' | 'error' | null;
}

const toLatLng = (point: GeoPoint): L.LatLngTuple => [point.lat, point.lon];

/** A small, unmistakably-a-mountain glyph — compact enough for mobile, obvious at a glance. */
function mountainDivIcon(selected: boolean): L.DivIcon {
  return L.divIcon({
    className: `mm-pin${selected ? ' is-selected' : ''}`,
    html: '<span class="mm-pin-glyph" aria-hidden="true">▲</span>',
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    tooltipAnchor: [0, -14],
  });
}

function originDivIcon(isGps: boolean): L.DivIcon {
  return L.divIcon({
    className: `mm-origin${isGps ? ' is-gps' : ''}`,
    html: '<span class="mm-origin-dot" aria-hidden="true"></span><span class="mm-origin-ring" aria-hidden="true"></span>',
    iconSize: [1, 1],
    iconAnchor: [0, 0],
  });
}

function clusterDivIcon(cluster: L.MarkerCluster): L.DivIcon {
  return L.divIcon({
    className: 'mm-cluster',
    html: `<span class="mm-cluster-count" aria-hidden="true">${cluster.getChildCount()}</span>`,
    iconSize: [34, 34],
  });
}

/**
 * Several Colorado resorts (Summit County above all) sit only a few real
 * miles apart — close enough that at any zoom wide enough to show the whole
 * state, their markers physically overlap on a phone screen, and a tap can
 * land on the wrong one. `leaflet.markercluster` is the standard answer for
 * exactly this: nearby pins collapse into one cluster bubble that expands
 * (zooming in) on tap, so a mistaken tap is never actually possible — it
 * either hits one unambiguous mountain, or a cluster that has to be opened
 * first. Individual peaks that aren't part of a tight cluster stay single-tap.
 *
 * This manages its own imperative Leaflet layer (clustering needs one)
 * rather than react-leaflet's declarative `<Marker>` — real coordinates and
 * click wiring are identical either way, only the mounting mechanism differs.
 */
function MountainClusterLayer({
  mountains,
  selectedMountainId,
  onSelectMountain,
}: {
  mountains: Mountain[];
  selectedMountainId: string | null;
  onSelectMountain: (mountainId: string) => void;
}) {
  const map = useMap();
  const groupRef = useRef<L.MarkerClusterGroup | null>(null);

  useEffect(() => {
    const group = L.markerClusterGroup({
      maxClusterRadius: 28,
      showCoverageOnHover: false,
      spiderfyOnMaxZoom: true,
      iconCreateFunction: clusterDivIcon,
    });
    group.addTo(map);
    groupRef.current = group;
    return () => {
      group.remove();
      groupRef.current = null;
    };
  }, [map]);

  useEffect(() => {
    const group = groupRef.current;
    if (!group) return;
    group.clearLayers();
    for (const mountain of mountains) {
      const isSelected = mountain.id === selectedMountainId;
      const marker = L.marker(toLatLng(mountain.coordinates), {
        icon: mountainDivIcon(isSelected),
        keyboard: false,
      });
      marker.on('click', () => onSelectMountain(mountain.id));
      marker.bindTooltip(mountain.shortName, {
        permanent: isSelected,
        direction: 'top',
        offset: [0, -16],
        className: 'mm-tooltip',
      });
      // The real accessible/keyboard control for this mountain is the button
      // below the map (see the visually-hidden mountain list) — marking the
      // visual pin `aria-hidden` avoids the same target being announced
      // twice, once for a decorative element whose geometry a screen reader
      // has no use for.
      marker.on('add', () => marker.getElement()?.setAttribute('aria-hidden', 'true'));
      group.addLayer(marker);
    }
  }, [mountains, selectedMountainId, onSelectMountain]);

  return null;
}

/**
 * Keeps the map framed on whatever's relevant: Colorado (plus the origin, if
 * it's off in another state) when nothing is selected, or the origin and the
 * selected mountain — and the real route between them, when one exists —
 * once a mountain is tapped. Runs inside `MapContainer` so it can reach the
 * live Leaflet map instance via `useMap()`.
 */
function MapFraming({
  origin,
  selectedMountain,
  routePoints,
  homeBounds,
}: {
  origin: Origin;
  selectedMountain: Mountain | null;
  routePoints: GeoPoint[] | null;
  homeBounds: L.LatLngBounds;
}) {
  const map = useMap();

  useEffect(() => {
    if (selectedMountain) {
      const points = routePoints && routePoints.length > 1 ? routePoints : [origin.coordinates, selectedMountain.coordinates];
      const bounds = L.latLngBounds(points.map(toLatLng));
      map.flyToBounds(bounds, { padding: [48, 48], maxZoom: 12, duration: 0.6 });
      return;
    }
    const bounds = L.latLngBounds(homeBounds.getSouthWest(), homeBounds.getNorthEast()).extend(
      toLatLng(origin.coordinates),
    );
    map.flyToBounds(bounds, { padding: [30, 30], duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMountain?.id, origin.coordinates.lat, origin.coordinates.lon, routePoints, homeBounds]);

  return null;
}

/**
 * `MapContainer` only forwards `className`/`id`/`style` to the DOM node it
 * renders — everything else, `aria-label` included, is treated as a Leaflet
 * `Map` constructor option and silently dropped. Setting it here, directly
 * on the real container Leaflet built, is the only way it actually reaches
 * the accessibility tree.
 */
function MapAccessibleLabel({ label }: { label: string }) {
  const map = useMap();
  useEffect(() => {
    map.getContainer().setAttribute('aria-label', label);
  }, [map, label]);
  return null;
}

/**
 * A real, pannable, zoomable Colorado map — CARTO's keyless dark basemap (no
 * API key, same "no secrets in the client" rule the traffic proxy already
 * follows), every mountain positioned at its real coordinates from the
 * canonical `Mountain` dataset. Selecting a mountain draws the real driven
 * route when one is available, and a clearly-marked approximate line — never
 * a route dressed up as real — when it isn't.
 */
export function MountainMap({
  mountains,
  origin,
  selectedMountainId,
  onSelectMountain,
  route,
}: MountainMapProps) {
  const selected = mountains.find((m) => m.id === selectedMountainId) ?? null;
  const isGps = origin.id === 'gps';

  const resolvedRoute = route && route !== 'loading' && route !== 'error' ? route : null;
  const routePoints = resolvedRoute?.routePoints ?? null;
  const showApproximateLine = Boolean(selected) && Boolean(resolvedRoute) && !routePoints;

  const originIcon = useMemo(() => originDivIcon(isGps), [isGps]);

  // The default view frames every supported mountain, not the whole state
  // rectangle — Colorado has a lot of empty plains a resort map has no
  // reason to show, and a tighter default fit is also what keeps closely
  // spaced resorts (Summit County) far enough apart in screen pixels to stay
  // out of the same cluster at first glance.
  const homeBounds = useMemo(() => L.latLngBounds(mountains.map((m) => toLatLng(m.coordinates))), [mountains]);

  return (
    <figure className="mountainmap">
      <MapContainer
        bounds={homeBounds}
        className="mountainmap-leaflet"
        scrollWheelZoom
        attributionControl
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          maxZoom={19}
          className="mountainmap-tiles"
        />

        <MapAccessibleLabel label={`Map of ${mountains.length} Colorado mountains relative to ${origin.name}`} />
        <MapFraming origin={origin} selectedMountain={selected} routePoints={routePoints} homeBounds={homeBounds} />

        {routePoints && routePoints.length > 1 && (
          <Polyline
            positions={routePoints.map(toLatLng)}
            pathOptions={{ className: 'mm-route is-real' }}
          />
        )}
        {showApproximateLine && selected && (
          <Polyline
            positions={[toLatLng(origin.coordinates), toLatLng(selected.coordinates)]}
            pathOptions={{ className: 'mm-route is-approximate', dashArray: '2 10' }}
          />
        )}

        <MountainClusterLayer
          mountains={mountains}
          selectedMountainId={selectedMountainId}
          onSelectMountain={onSelectMountain}
        />

        <Marker
          position={toLatLng(origin.coordinates)}
          icon={originIcon}
          interactive={false}
          keyboard={false}
          ref={(instance) => {
            const el = instance?.getElement();
            el?.setAttribute('aria-hidden', 'true');
          }}
        >
          <Tooltip permanent direction="top" offset={[0, -6]} className="mm-origin-tooltip">
            {isGps ? 'You' : origin.shortName}
          </Tooltip>
        </Marker>
      </MapContainer>

      {/*
       * A map pin is a mouse/touch affordance a screen reader can't usefully
       * navigate by shape or position. This list is the real, focusable
       * control for every mountain — visually hidden, but functionally
       * identical to tapping its pin, and exactly what keyboard and
       * screen-reader users actually interact with.
       */}
      <div className="visually-hidden" role="group" aria-label="Mountains">
        {mountains.map((mountain) => {
          const isSelected = mountain.id === selectedMountainId;
          return (
            <button
              key={mountain.id}
              type="button"
              aria-pressed={isSelected}
              onClick={() => onSelectMountain(mountain.id)}
            >
              {mountain.name}
              {isSelected ? ' (selected)' : ''}. Tap to view mountain conditions and route.
            </button>
          );
        })}
      </div>

      <figcaption className="mountainmap-legend">
        <span className="mountainmap-legend-item">
          <span className="mountainmap-swatch is-origin" aria-hidden="true" /> {isGps ? 'Your location' : origin.shortName}
        </span>
        <span className="mountainmap-legend-item">
          <span className="mountainmap-swatch is-mountain" aria-hidden="true" /> Mountain
        </span>
        {showApproximateLine && (
          <span className="mountainmap-legend-item mountainmap-legend-note">
            Dashed line is approximate direction, not the actual road
          </span>
        )}
      </figcaption>
    </figure>
  );
}
