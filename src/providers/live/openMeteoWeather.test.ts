import { afterEach, describe, expect, it, vi } from 'vitest';
import { at, HOUR, minuteRange } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { testMountain } from '@/test/fixtures';
import { OpenMeteoWeatherProvider } from './openMeteoWeather';

const TODAY = '2026-01-17';
const mountain = testMountain();

/** A structurally realistic Open-Meteo hourly response, hand-built to match the documented shape. */
function buildResponse(options: {
  date: string;
  overnightSnowCm?: number;
  daySnowCm?: number;
  tempC?: number;
  windKmh?: number;
} = { date: TODAY }) {
  const { date, overnightSnowCm = 0, daySnowCm = 0, tempC = -5, windKmh = 15 } = options;
  const prevDay = new Date(`${date}T00:00:00Z`);
  prevDay.setUTCDate(prevDay.getUTCDate() - 1);
  const prevDayKey = prevDay.toISOString().slice(0, 10);

  const time: string[] = [];
  const temperature_2m: number[] = [];
  const snowfall: number[] = [];
  const windspeed_10m: number[] = [];
  const windgusts_10m: number[] = [];
  const winddirection_10m: number[] = [];
  const cloudcover: number[] = [];
  const visibility: number[] = [];
  const precipitation_probability: number[] = [];
  const freezinglevel_height: number[] = [];

  // Two days of hours: the day before (evening snow = "overnight") and the target date.
  for (const [dayKey, isTarget] of [[prevDayKey, false], [date, true]] as const) {
    for (let h = 0; h < 24; h += 1) {
      time.push(`${dayKey}T${String(h).padStart(2, '0')}:00`);
      // 12 total "overnight" hours (6pm-midnight the day before + midnight-6am
      // the target date) share the overnight total evenly.
      const isOvernightHour = (!isTarget && h >= 18) || (isTarget && h < 6);
      snowfall.push(isOvernightHour ? overnightSnowCm / 12 : isTarget && h >= 6 && h < 12 ? daySnowCm / 6 : 0);
      temperature_2m.push(tempC);
      windspeed_10m.push(windKmh);
      windgusts_10m.push(windKmh * 1.4);
      winddirection_10m.push(270);
      cloudcover.push(60);
      visibility.push(12000);
      precipitation_probability.push(40);
      freezinglevel_height.push(1800);
    }
  }

  return {
    hourly: {
      time,
      temperature_2m,
      snowfall,
      windspeed_10m,
      windgusts_10m,
      winddirection_10m,
      cloudcover,
      visibility,
      precipitation_probability,
      freezinglevel_height,
    },
  };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('OpenMeteoWeatherProvider — normalization', () => {
  it('maps a realistic response into the normalized MountainWeather shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(buildResponse({ date: TODAY, overnightSnowCm: 20 })), { status: 200 })),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));

    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.overnightSnowIn).toBeCloseTo(20 / 2.54, 1);
    expect(result.data.hourly.length).toBeGreaterThan(10);
    expect(result.data.hourly[0]).toMatchObject({
      minute: at(4),
    });
    // Extra fields the engine doesn't read are still passed through honestly.
    expect(result.data.hourly[0]?.cloudCoverPct).toBe(60);
    expect(result.data.hourly[0]?.windDirectionDeg).toBe(270);
  });

  it('stamps live provenance with fetchedAt/validUntil, never demo', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(buildResponse()), { status: 200 })));
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.provenance.source).toBe('live');
    expect(result.provenance.provider).toBe('open-meteo');
    expect(result.provenance.fetchedAt).toBeTruthy();
    expect(result.provenance.validUntil).toBeTruthy();
    expect(new Date(result.provenance.validUntil!).getTime()).toBeGreaterThan(
      new Date(result.provenance.fetchedAt!).getTime(),
    );
    // Open-Meteo is called directly, first-party — never carries the
    // third-party caveat that only a source like Liftie should set.
    expect(result.provenance.attribution).toBeUndefined();
  });

  it('converts units correctly: cm→in snow, km/h→mph wind, °C→°F temp', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(JSON.stringify(buildResponse({ date: TODAY, tempC: 0, windKmh: 32.1869 })), {
            status: 200,
          }),
      ),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    const hour = result.data.hourly.find((h) => h.minute === at(12));
    expect(hour?.temperatureF).toBe(32); // 0°C = 32°F
    expect(hour?.windMph).toBe(20); // 32.1869 km/h ≈ 20 mph
  });
});

describe('OpenMeteoWeatherProvider — failure handling', () => {
  it('returns unavailable on a non-2xx response, never a fabricated forecast', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('rate limited', { status: 429 })));
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable on malformed JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{broken', { status: 200 })));
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('unavailable');
  });

  it('returns unavailable when required hourly fields are missing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify({ hourly: { time: ['2026-01-17T04:00'] } }), { status: 200 })),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('unavailable');
    if (result.status === 'unavailable') expect(result.reason).toBeTruthy();
  });

  it('returns unavailable on a network/timeout failure rather than throwing', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => {
        throw new TypeError('Failed to fetch');
      }),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('unavailable');
  });

  it('refuses to forecast beyond what Open-Meteo actually covers', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify(buildResponse()), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new OpenMeteoWeatherProvider();
    const farFuture = '2026-03-01'; // > 16 days from TODAY
    const result = await provider.getMountainWeather(mountain, makeContext(farFuture, TODAY, at(5)));
    expect(result.status).toBe('unavailable');
    // And it should not have even made the request — there is nothing honest to ask for.
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns unavailable when the target date has no matching hours in the response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => new Response(JSON.stringify(buildResponse({ date: '2020-01-01' })), { status: 200 })),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('unavailable');
  });
});

describe('OpenMeteoWeatherProvider — request shape', () => {
  it('requests an elevation-adjusted forecast at the mountain coordinates', async () => {
    const fetchSpy = vi.fn(
      async (_url: string, _init?: RequestInit) => new Response(JSON.stringify(buildResponse()), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchSpy);
    const provider = new OpenMeteoWeatherProvider();
    await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));

    const requestedUrl = new URL(fetchSpy.mock.calls[0]![0]);
    expect(requestedUrl.hostname).toBe('api.open-meteo.com');
    expect(requestedUrl.searchParams.get('latitude')).toBe(mountain.weatherLocation.point.lat.toFixed(4));
    expect(Number(requestedUrl.searchParams.get('elevation'))).toBeGreaterThan(2500); // ~10,500ft in meters
    expect(requestedUrl.searchParams.get('hourly')).toContain('snowfall');
  });
});

// Sanity: the fixture builder itself produces coherent minute coverage.
describe('fixture sanity', () => {
  it('covers the full 4am-8pm window the provider samples', () => {
    const minutes = minuteRange(at(4), at(20), HOUR);
    expect(minutes.length).toBe(17);
  });
});

/** Elevation (m) the provider requests for each of testMountain()'s named points. */
const BASE_ELEVATION_M = Math.round(mountain.elevations.baseFt / 3.28084);
const PEAK_ELEVATION_M = Math.round(mountain.elevations.summitFt / 3.28084);

function isMainRequest(url: URL): boolean {
  return (url.searchParams.get('hourly') ?? '').includes('freezinglevel_height');
}

/** A minimal single-elevation response, as the base/peak requests expect. */
function buildElevationResponse(options: { snowDepthM?: number | null } = {}) {
  const time: string[] = [];
  const temperature_2m: number[] = [];
  const windspeed_10m: number[] = [];
  const windgusts_10m: number[] = [];
  const snow_depth: (number | null)[] = [];
  for (let h = 0; h < 24; h += 1) {
    time.push(`${TODAY}T${String(h).padStart(2, '0')}:00`);
    temperature_2m.push(-4);
    windspeed_10m.push(12);
    windgusts_10m.push(20);
    snow_depth.push(options.snowDepthM === undefined ? 1 : options.snowDepthM);
  }
  return { hourly: { time, temperature_2m, windspeed_10m, windgusts_10m, snow_depth } };
}

/** The main response, extended with an 11-day daily snowfall aggregate centered on `TODAY`. */
function buildResponseWithDaily(dailySnowfallCm: number[]) {
  const main = buildResponse({ date: TODAY });
  const time: string[] = [];
  for (let offset = -5; offset <= 5; offset += 1) {
    const d = new Date(`${TODAY}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + offset);
    time.push(d.toISOString().slice(0, 10));
  }
  return { ...main, daily: { time, snowfall_sum: dailySnowfallCm } };
}

describe('OpenMeteoWeatherProvider — base and peak conditions', () => {
  it('resolves base and peak from independent, elevation-specific requests', async () => {
    const fetchMock = vi.fn(async (rawUrl: string) => {
      const url = new URL(rawUrl);
      if (isMainRequest(url)) {
        return new Response(JSON.stringify(buildResponse({ date: TODAY })), { status: 200 });
      }
      const elevation = Number(url.searchParams.get('elevation'));
      const snowDepthM = elevation === BASE_ELEVATION_M ? 1.2 : elevation === PEAK_ELEVATION_M ? 2.4 : 0;
      return new Response(JSON.stringify(buildElevationResponse({ snowDepthM })), { status: 200 });
    });
    vi.stubGlobal('fetch', fetchMock);

    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    expect(result.data.base).not.toBeNull();
    expect(result.data.peak).not.toBeNull();
    // Peak is colder/windier here and, crucially, never copied from base.
    expect(result.data.base!.snowDepthIn).toBeCloseTo(1.2 * 39.3701, 0);
    expect(result.data.peak!.snowDepthIn).toBeCloseTo(2.4 * 39.3701, 0);
    expect(result.data.peak!.snowDepthIn).not.toBe(result.data.base!.snowDepthIn);
    expect(result.data.base!.source).toBe('open-meteo');
  });

  it('reports snow depth as unavailable (null), never copied from the other elevation, when the provider omits it', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (rawUrl: string) => {
        const url = new URL(rawUrl);
        if (isMainRequest(url)) {
          return new Response(JSON.stringify(buildResponse({ date: TODAY })), { status: 200 });
        }
        return new Response(JSON.stringify(buildElevationResponse({ snowDepthM: null })), { status: 200 });
      }),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.base!.snowDepthIn).toBeNull();
    expect(result.data.peak!.snowDepthIn).toBeNull();
  });

  it('leaves peak unavailable — never copied from base — when only the summit request fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (rawUrl: string) => {
        const url = new URL(rawUrl);
        if (isMainRequest(url)) {
          return new Response(JSON.stringify(buildResponse({ date: TODAY })), { status: 200 });
        }
        const elevation = Number(url.searchParams.get('elevation'));
        if (elevation === PEAK_ELEVATION_M) {
          return new Response('rate limited', { status: 429 });
        }
        return new Response(JSON.stringify(buildElevationResponse({ snowDepthM: 1.5 })), { status: 200 });
      }),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    // The overall forecast still succeeds — one elevation point failing
    // never takes the whole weather call down.
    expect(result.data.base).not.toBeNull();
    expect(result.data.peak).toBeNull();
  });
});

describe('OpenMeteoWeatherProvider — 5-day snow history', () => {
  it('splits the daily aggregate into 5 real days back and 5 projected days forward, anchored to today', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (rawUrl: string) => {
        const url = new URL(rawUrl);
        if (isMainRequest(url)) {
          // 11 days: day -5..-1 observed, today, day +1..+5 forecast (cm).
          const cm = [2, 0, 0, 5, 1, 0, 3, 0, 0, 8, 1];
          return new Response(JSON.stringify(buildResponseWithDaily(cm)), { status: 200 });
        }
        return new Response(JSON.stringify(buildElevationResponse()), { status: 200 });
      }),
    );
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;

    const history = result.data.snowHistory;
    expect(history).not.toBeNull();
    if (!history) return;
    expect(history.past.length).toBe(5);
    expect(history.future.length).toBe(5);
    expect(history.past.every((day) => day.kind === 'observed')).toBe(true);
    expect(history.future.every((day) => day.kind === 'forecast')).toBe(true);
    // Each day is converted and rounded to a tenth before summing, so the
    // total always matches what the five daily figures actually add up to.
    expect(history.pastTotalIn).toBeCloseTo(3.2, 1);
    expect(history.futureTotalIn).toBeCloseTo(4.7, 1);
  });

  it('returns null rather than a fabricated history when the daily aggregate is absent', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(buildResponse({ date: TODAY })), { status: 200 })));
    const provider = new OpenMeteoWeatherProvider();
    const result = await provider.getMountainWeather(mountain, makeContext(TODAY, TODAY, at(5)));
    expect(result.status).toBe('ok');
    if (result.status !== 'ok') return;
    expect(result.data.snowHistory).toBeNull();
  });
});
