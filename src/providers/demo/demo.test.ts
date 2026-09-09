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

describe('regional storm tracks', () => {
  it('models the two regions separately', () => {
    const i70 = regionalPattern(TODAY, 0, 'i70-corridor');
    const sanJuans = regionalPattern(TODAY, 0, 'san-juans');
    expect(i70.region).toBe('i70-corridor');
    expect(sanJuans.region).toBe('san-juans');
    expect(i70.stormIntensity).not.toBe(sanJuans.stormIntensity);
  });

  it('lets one region get hammered while the other gets nothing', () => {
    let diverged = false;
    for (let day = 1; day <= 60 && !diverged; day += 1) {
      const date = `2026-01-${String(day <= 31 ? day : day - 31).padStart(2, '0')}`;
      const key = day <= 31 ? date : date.replace('01-', '02-');
      const a = regionalPattern(key, day, 'i70-corridor').stormIntensity;
      const b = regionalPattern(key, day, 'san-juans').stormIntensity;
      if (Math.abs(a - b) > 0.45) diverged = true;
    }
    expect(diverged).toBe(true);
  });

  it('still correlates them — they are the same state, not two planets', () => {
    let together = 0;
    for (let day = 1; day <= 28; day += 1) {
      const key = `2026-01-${String(day).padStart(2, '0')}`;
      const a = regionalPattern(key, day, 'i70-corridor').stormIntensity;
      const b = regionalPattern(key, day, 'san-juans').stormIntensity;
      if (Math.abs(a - b) < 0.25) together += 1;
    }
    expect(together).toBeGreaterThan(4);
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

describe('ticket pricing', () => {
  it('quotes every mountain and stamps the quote as demo', async () => {
    for (const mountain of MOUNTAINS) {
      const result = await registry.pricing.getTicketPrice(mountain, context);
      expect(result.status, mountain.id).toBe('ok');
      if (result.status !== 'ok') continue;
      expect(result.provenance.source).toBe('demo');
      expect(result.data.adultDay).toBeGreaterThan(0);
      expect(result.data.mountainId).toBe(mountain.id);
      expect(result.data.currency).toBe('USD');
    }
  });

  it('is deterministic for a given mountain and date', async () => {
    const [a, b] = await Promise.all([
      registry.pricing.getTicketPrice(MOUNTAINS[0]!, context),
      registry.pricing.getTicketPrice(MOUNTAINS[0]!, context),
    ]);
    expect(a).toEqual(b);
  });

  it('charges same-day window pricing and discounts booking ahead', async () => {
    const mountain = findMountain('vail')!;
    const sameDay = await registry.pricing.getTicketPrice(mountain, context);
    const ahead = await registry.pricing.getTicketPrice(
      mountain,
      makeContext('2026-02-05', TODAY, at(5, 0)),
    );
    if (sameDay.status !== 'ok' || ahead.status !== 'ok') throw new Error('expected pricing');
    expect(sameDay.data.kind).toBe('window');
    expect(ahead.data.kind).toBe('advance');
    expect(ahead.data.adultDay).toBeLessThan(sameDay.data.adultDay);
  });

  it('never quotes above the published window rate', async () => {
    for (const mountain of MOUNTAINS) {
      const result = await registry.pricing.getTicketPrice(mountain, context);
      if (result.status !== 'ok') continue;
      expect(result.data.adultDay, mountain.id).toBeLessThanOrEqual(result.data.windowRate);
    }
  });

  it('prices the independent well below the destination resorts', async () => {
    const [purgatory, vail] = await Promise.all([
      registry.pricing.getTicketPrice(findMountain('purgatory')!, context),
      registry.pricing.getTicketPrice(findMountain('vail')!, context),
    ]);
    if (purgatory.status !== 'ok' || vail.status !== 'ok') throw new Error('expected pricing');
    expect(purgatory.data.adultDay).toBeLessThan(vail.data.adultDay * 0.7);
  });

  it('reports unavailable rather than inventing a price', async () => {
    const failing = createDemoRegistry({ pricing: { failFor: () => true } });
    const result = await failing.pricing.getTicketPrice(MOUNTAINS[0]!, context);
    expect(result.status).toBe('unavailable');
  });
});

describe('mountain identity', () => {
  it('gives Purgatory its own weather, not a copy of the I-70 corridor', async () => {
    const [purgatory, keystone] = await Promise.all([
      registry.weather.getMountainWeather(findMountain('purgatory')!, context),
      registry.weather.getMountainWeather(findMountain('keystone')!, context),
    ]);
    if (purgatory.status !== 'ok' || keystone.status !== 'ok') throw new Error('expected weather');
    expect(purgatory.data.overnightSnowIn).not.toBe(keystone.data.overnightSnowIn);
  });

  it('reports grooming, and gives the grooming-focused mountain more of it', async () => {
    const [keystone, crestedButte] = await Promise.all([
      registry.mountain.getOperations(findMountain('keystone')!, context),
      registry.mountain.getOperations(findMountain('crested-butte')!, context),
    ]);
    if (keystone.status !== 'ok' || crestedButte.status !== 'ok') throw new Error('expected ops');
    expect(keystone.data.groomedShare).toBeGreaterThan(crestedButte.data.groomedShare);
  });

  it('exposes the alpine mountain to wind far more than the sheltered one', async () => {
    const [breck, purgatory] = await Promise.all([
      registry.weather.getMountainWeather(findMountain('breckenridge')!, context),
      registry.weather.getMountainWeather(findMountain('purgatory')!, context),
    ]);
    if (breck.status !== 'ok' || purgatory.status !== 'ok') throw new Error('expected weather');
    const peak = (hours: { windGustMph: number }[]) => Math.max(...hours.map((h) => h.windGustMph));
    expect(peak(breck.data.hourly)).toBeGreaterThan(peak(purgatory.data.hourly));
  });
});
