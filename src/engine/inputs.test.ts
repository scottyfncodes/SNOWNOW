import { describe, expect, it } from 'vitest';
import { MOUNTAINS, findMountain } from '@/data/mountains';
import { findOrigin } from '@/data/origins';
import { at } from '@/domain/time';
import { createDemoRegistry } from '@/providers/demo';
import type { ProviderRegistry } from '@/providers/types';
import { loadDayInputs, makeContext } from './inputs';

const TODAY = '2026-01-17';
const context = makeContext(TODAY, TODAY, at(5, 0));
const denver = findOrigin('denver');

describe('loadDayInputs', () => {
  it('gathers every feed for one mountain on one day', async () => {
    const inputs = await loadDayInputs(createDemoRegistry(), MOUNTAINS[0]!, denver, context);
    expect(inputs.weather.status).toBe('ok');
    expect(inputs.operations.status).toBe('ok');
    expect(inputs.outbound.status).toBe('ok');
    expect(inputs.inbound.status).toBe('ok');
    expect(inputs.isToday).toBe(true);
  });

  it('considers every route from the origin and picks the quickest', async () => {
    const breck = findMountain('breckenridge')!;
    const inputs = await loadDayInputs(createDemoRegistry(), breck, denver, context);
    expect(inputs.routes.length).toBeGreaterThan(1);
    expect(inputs.outboundOptions.length).toBe(inputs.routes.length);
  });

  it('degrades one feed at a time rather than failing the day', async () => {
    const registry = createDemoRegistry({ mountain: { failOperationsFor: () => true } });
    const inputs = await loadDayInputs(registry, MOUNTAINS[0]!, denver, context);
    expect(inputs.operations.status).toBe('unavailable');
    expect(inputs.weather.status).toBe('ok');
  });

  it('turns a thrown provider error into an honest empty state', async () => {
    const registry: ProviderRegistry = {
      ...createDemoRegistry(),
      weather: {
        id: 'exploding-weather',
        getMountainWeather: async () => {
          throw new Error('upstream 503');
        },
      },
    };
    const inputs = await loadDayInputs(registry, MOUNTAINS[0]!, denver, context);
    expect(inputs.weather.status).toBe('unavailable');
    if (inputs.weather.status === 'unavailable') {
      expect(inputs.weather.reason).toBe('upstream 503');
    }
  });

  it('reports no route when the origin cannot reach the mountain', async () => {
    const isolated = { ...MOUNTAINS[0]!, accessRoutes: [] };
    const inputs = await loadDayInputs(createDemoRegistry(), isolated, denver, context);
    expect(inputs.outbound.status).toBe('unavailable');
    expect(inputs.routes).toEqual([]);
  });

  it('computes the forecast horizon from today', () => {
    expect(makeContext('2026-01-20', TODAY, 0).horizonDays).toBe(3);
    expect(makeContext('2026-01-10', TODAY, 0).horizonDays).toBe(0);
  });
});
