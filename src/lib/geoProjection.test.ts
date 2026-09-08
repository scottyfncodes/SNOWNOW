import { describe, expect, it } from 'vitest';
import { buildProjector } from './geoProjection';

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
