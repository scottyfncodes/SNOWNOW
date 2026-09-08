import { describe, expect, it } from 'vitest';
import { buildProjector, declutterPoints } from './geoProjection';

describe('buildProjector', () => {
  const points = [
    { lat: 39.6403, lon: -106.3742 }, // Vail
    { lat: 37.2753, lon: -107.8801 }, // Durango
    { lat: 40.5853, lon: -105.0844 }, // Fort Collins
  ];

  it('keeps every point inside the requested viewport, honouring padding', () => {
    const width = 600;
    const height = 400;
    const padding = 20;
    const project = buildProjector(points, width, height, padding);
    for (const point of points) {
      const { x, y } = project(point);
      expect(x).toBeGreaterThanOrEqual(padding - 1);
      expect(x).toBeLessThanOrEqual(width - padding + 1);
      expect(y).toBeGreaterThanOrEqual(padding - 1);
      expect(y).toBeLessThanOrEqual(height - padding + 1);
    }
  });

  it('places a more northern point higher on the canvas (smaller y)', () => {
    const project = buildProjector(points, 600, 400, 20);
    const north = project({ lat: 40.5853, lon: -105.0844 });
    const south = project({ lat: 37.2753, lon: -107.8801 });
    expect(north.y).toBeLessThan(south.y);
  });

  it('places a more eastern point further right (larger x)', () => {
    const project = buildProjector(points, 600, 400, 20);
    const east = project({ lat: 39.6403, lon: -105.0844 });
    const west = project({ lat: 39.6403, lon: -107.8801 });
    expect(east.x).toBeGreaterThan(west.x);
  });

  it('handles a single point without dividing by zero', () => {
    const project = buildProjector([{ lat: 39.5, lon: -106 }], 400, 300, 10);
    const { x, y } = project({ lat: 39.5, lon: -106 });
    expect(Number.isFinite(x)).toBe(true);
    expect(Number.isFinite(y)).toBe(true);
  });
});

describe('declutterPoints', () => {
  it('leaves points alone when they are already far enough apart', () => {
    const points = [{ x: 0, y: 0 }, { x: 100, y: 0 }];
    const result = declutterPoints(points, 20);
    expect(result).toEqual(points);
  });

  it('pushes overlapping points apart until they clear the minimum distance', () => {
    const points = [{ id: 'a', x: 50, y: 50 }, { id: 'b', x: 52, y: 51 }];
    const [a, b] = declutterPoints(points, 30);
    expect(Math.hypot(b!.x - a!.x, b!.y - a!.y)).toBeGreaterThanOrEqual(29.9);
  });

  it('separates every pair in a tight cluster, not just the closest one', () => {
    const points = [
      { id: 'summit-1', x: 100, y: 100 },
      { id: 'summit-2', x: 102, y: 99 },
      { id: 'summit-3', x: 99, y: 103 },
      { id: 'summit-4', x: 101, y: 101 },
    ];
    const result = declutterPoints(points, 24);
    for (let i = 0; i < result.length; i += 1) {
      for (let j = i + 1; j < result.length; j += 1) {
        const dx = result[j]!.x - result[i]!.x;
        const dy = result[j]!.y - result[i]!.y;
        expect(Math.hypot(dx, dy)).toBeGreaterThanOrEqual(23.9);
      }
    }
  });

  it('handles two points at the exact same spot without producing NaN', () => {
    const points = [{ x: 10, y: 10 }, { x: 10, y: 10 }];
    const [a, b] = declutterPoints(points, 20);
    expect(Number.isFinite(a!.x)).toBe(true);
    expect(Number.isFinite(b!.x)).toBe(true);
    expect(Math.hypot(b!.x - a!.x, b!.y - a!.y)).toBeGreaterThanOrEqual(19.9);
  });

  it('never mutates the input points', () => {
    const points = [{ x: 0, y: 0 }, { x: 1, y: 1 }];
    const snapshot = points.map((p) => ({ ...p }));
    declutterPoints(points, 30);
    expect(points).toEqual(snapshot);
  });
});
