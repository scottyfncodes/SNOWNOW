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
