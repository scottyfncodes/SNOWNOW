import type { GeoPoint } from '@/domain/mountain';

/**
 * A small equirectangular projection for the mountain map's hand-drawn SVG —
 * same philosophy as `ui/components/chart.ts`: no mapping library, no tile
 * server, just enough geometry to place real coordinates on a flat plane
 * that reads correctly at Colorado's latitude.
 *
 * This is a *schematic* projection for a small, well-known region, not a
 * general-purpose map projection — it is not meant to be reused far outside
 * the bounds it is built from.
 */
export interface Projector {
  (point: GeoPoint): { x: number; y: number };
  bounds: { minLat: number; maxLat: number; minLon: number; maxLon: number };
}

/**
 * Builds a projector that fits every given point inside `[0, width] x [0, height]`
 * with `padding` pixels of margin, preserving aspect ratio via a
 * latitude-corrected longitude scale (`cos` of the mid-latitude) so the result
 * doesn't visibly stretch east-west.
 */
export function buildProjector(
  points: GeoPoint[],
  width: number,
  height: number,
  padding: number,
): Projector {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);

  const midLatRad = ((minLat + maxLat) / 2) * (Math.PI / 180);
  const lonScale = Math.cos(midLatRad);

  // Degrees-space width/height, longitude compressed by latitude so a degree
  // of longitude and a degree of latitude cover comparable ground distance.
  const spanX = Math.max((maxLon - minLon) * lonScale, 0.05);
  const spanY = Math.max(maxLat - minLat, 0.05);

  const innerW = Math.max(1, width - padding * 2);
  const innerH = Math.max(1, height - padding * 2);
  // One shared scale for both axes (fit-within, not stretch-to-fill) keeps
  // the map's real proportions honest.
  const scale = Math.min(innerW / spanX, innerH / spanY);

  const usedW = spanX * scale;
  const usedH = spanY * scale;
  const offsetX = padding + (innerW - usedW) / 2;
  const offsetY = padding + (innerH - usedH) / 2;

  const project = ((point: GeoPoint) => {
    const x = offsetX + (point.lon - minLon) * lonScale * scale;
    // SVG y grows downward; latitude grows northward, so flip.
    const y = offsetY + (maxLat - point.lat) * scale;
    return { x, y };
  }) as Projector;
  project.bounds = { minLat, maxLat, minLon, maxLon };
  return project;
}

export interface Point2D {
  x: number;
  y: number;
}

/**
 * Nudges projected points that land too close together apart, so their touch
 * targets never fully overlap. This is purely a rendering concern for a
 * schematic map — several Colorado resorts (Summit County above all) sit
 * only a few real miles apart, close enough that their true projected
 * positions can land on top of each other at phone-screen scale, silently
 * eating the tap meant for whichever marker is on top. The geographic
 * projection each point started from is never touched; only where the
 * marker actually gets drawn moves, and only exactly as far as it has to.
 */
export function declutterPoints<T extends Point2D>(points: T[], minDistance: number, iterations = 24): T[] {
  const result = points.map((point) => ({ ...point }));
  for (let iteration = 0; iteration < iterations; iteration += 1) {
    let moved = false;
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const a = result[i]!;
        const b = result[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);
        if (distance >= minDistance) continue;
        moved = true;
        // Two points starting at the exact same spot have no direction to push
        // apart along — pick a deterministic one (the golden angle keeps a
        // whole cluster of coincident points from collapsing back together).
        const angle = distance > 1e-6 ? Math.atan2(dy, dx) : (i * 137.5 * Math.PI) / 180;
        const push = (minDistance - distance) / 2 + 0.05;
        const ux = Math.cos(angle);
        const uy = Math.sin(angle);
        a.x -= ux * push;
        a.y -= uy * push;
        b.x += ux * push;
        b.y += uy * push;
      }
    }
    if (!moved) break;
  }
  return result;
}
