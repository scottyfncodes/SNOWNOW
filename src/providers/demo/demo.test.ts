import { describe, expect, it } from 'vitest';
import { MOUNTAINS, findMountain } from '@/data/mountains';
import { findOrigin } from '@/data/origins';
import { primaryRoute } from '@/domain/mountain';
import { at } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { travelAt } from '@/engine/travel';
import { createDemoRegistry } from './index';
import { regionalPattern } from './scenario';

const TODAY = '2026-01-17';
const context = makeContext(TODAY, TODAY, at(5, 0));
const registry = createDemoRegistry();
const denver = findOrigin('denver');

describe('demo data honesty', () => {
  it('stamps every value as demo', async () => {
    const weather = await registry.weather.getMountainWeather(MOUNTAINS[0]!, context);
    expect(weather.status).toBe('ok');
    if (weather.status === 'ok') expect(weather.provenance.source).toBe('demo');
    expect(registry.usingDemoData).toBe(true);
  });

  it('labels today as observed and future days as forecast or projected', async () => {
    const soon = makeContext('2026-01-20', TODAY, at(5, 0));
    const far = makeContext('2026-02-02', TODAY, at(5, 0));
    const a = await registry.weather.getMountainWeather(MOUNTAINS[0]!, soon);
    const b = await registry.weather.getMountainWeather(MOUNTAINS[0]!, far);
    expect(a.status === 'ok' && a.provenance.observation).toBe('forecast');
    expect(b.status === 'ok' && b.provenance.observation).toBe('projected');
  });
});

describe('determinism', () => {
  it('returns the same world for the same date', () => {
    expect(regionalPattern(TODAY, 0)).toEqual(regionalPattern(TODAY, 0));
  });

  it('returns a different world on a different date', () => {
    expect(regionalPattern(TODAY, 0).stormIntensity).not.toBe(
      regionalPattern('2026-02-11', 3).stormIntensity,
    );
  });

  it('gives identical weather across repeated calls', async () => {
    const [a, b] = await Promise.all([
      registry.weather.getMountainWeather(MOUNTAINS[0]!, context),
      registry.weather.getMountainWeather(MOUNTAINS[0]!, context),
    ]);
    expect(a).toEqual(b);
  });
});

describe('the demo actually differentiates the mountains', () => {
  it('does not hand every mountain the same snow', async () => {
    const totals = await Promise.all(
      MOUNTAINS.map(async (mountain) => {
        const result = await registry.weather.getMountainWeather(mountain, context);
        return result.status === 'ok' ? result.data.overnightSnowIn : 0;
      }),
    );
    const spread = Math.max(...totals) - Math.min(...totals);
    expect(spread).toBeGreaterThan(2);
  });

  it('gives the far mountain a much longer drive than the near one', async () => {
    const keystone = findMountain('keystone')!;
    const crestedButte = findMountain('crested-butte')!;
    const near = await registry.traffic.getTravelCurve(
      primaryRoute(keystone, 'denver')!,
      'outbound',
      context,
    );
    const far = await registry.traffic.getTravelCurve(
      primaryRoute(crestedButte, 'denver')!,
      'outbound',
      context,
    );
    expect(near.status).toBe('ok');
    expect(far.status).toBe('ok');
    if (near.status === 'ok' && far.status === 'ok') {
      expect(travelAt(far.data, at(5)).durationMinutes).toBeGreaterThan(
        travelAt(near.data, at(5)).durationMinutes * 1.8,
      );
    }
  });

  it('gives the quiet mountain fewer people than the Front Range favourite', async () => {
    const [breck, cb] = await Promise.all([
      registry.mountain.getCrowdForecast(findMountain('breckenridge')!, context),
      registry.mountain.getCrowdForecast(findMountain('crested-butte')!, context),
    ]);
    if (breck.status === 'ok' && cb.status === 'ok') {
      expect(cb.data.dayFactor).toBeLessThan(breck.data.dayFactor);
    }
  });
});

describe('departure-time-dependent traffic', () => {
  it('makes the morning meaningfully worse at rush hour than at dawn', async () => {
    const route = primaryRoute(findMountain('breckenridge')!, 'denver')!;
    const result = await registry.traffic.getTravelCurve(route, 'outbound', context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const dawn = travelAt(result.data, at(5)).durationMinutes;
    const rush = travelAt(result.data, at(7, 30)).durationMinutes;
    expect(rush).toBeGreaterThan(dawn * 1.25);
  });

  it('has an afternoon wall on the way home that later clears', async () => {
    const route = primaryRoute(findMountain('breckenridge')!, 'denver')!;
    const result = await registry.traffic.getTravelCurve(route, 'return', context);
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const early = travelAt(result.data, at(13)).durationMinutes;
    const wall = travelAt(result.data, at(16, 15)).durationMinutes;
    const evening = travelAt(result.data, at(19, 30)).durationMinutes;
    expect(wall).toBeGreaterThan(early);
    expect(evening).toBeLessThan(wall);
  });
});

describe('provider failure injection', () => {
  it('reports weather as unavailable without throwing', async () => {
    const failing = createDemoRegistry({ weather: { failFor: () => true } });
    const result = await failing.weather.getMountainWeather(MOUNTAINS[0]!, context);
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.reason).toBeTruthy();
  });

  it('reports traffic as unavailable without throwing', async () => {
    const failing = createDemoRegistry({ traffic: { failFor: () => true } });
    const route = primaryRoute(MOUNTAINS[0]!, 'denver')!;
    const result = await failing.traffic.getTravelCurve(route, 'outbound', context);
    expect(result.status).toBe('unavailable');
  });

  it('reports lift operations as unavailable without throwing', async () => {
    const failing = createDemoRegistry({ mountain: { failOperationsFor: () => true } });
    const result = await failing.mountain.getOperations(MOUNTAINS[0]!, context);
    expect(result.status).toBe('unavailable');
  });
});

describe('places', () => {
  it('offers somewhere to wait out the traffic', async () => {
    const result = await registry.places.getPlaces(
      findMountain('breckenridge')!,
      denver,
      ['apres'],
      context,
    );
    expect(result.status).toBe('ok');
    if (result.status === 'ok') {
      expect(result.data.every((place) => place.kind === 'apres')).toBe(true);
    }
  });
});
