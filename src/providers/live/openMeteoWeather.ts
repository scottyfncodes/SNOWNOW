import type {
  DailySnowfall,
  ElevationConditions,
  HourlyWeather,
  MountainWeather,
  SnowHistory,
} from '@/domain/conditions';
import type { DateKey } from '@/domain/dates';
import type { Mountain } from '@/domain/mountain';
import {
  type Availability,
  confidenceForHorizon,
  observationForHorizon,
  ok,
  unavailable,
} from '@/domain/provenance';
import { at, clamp01, HOUR, minuteRange, type MinuteOfDay } from '@/domain/time';
import { bell } from '@/lib/curve';
import { fetchJson } from '@/lib/http';
import { estimateSnowDensity } from '@/lib/snow';
import type { ProviderContext, WeatherProvider } from '@/providers/types';

const FIRST_HOUR = at(4);
const LAST_HOUR = at(20);

/** Open-Meteo's free forecast tier. No API key: it is genuinely public. */
const BASE_URL = 'https://api.open-meteo.com/v1/forecast';

/** Open-Meteo will not forecast further out than this. Beyond it, we say so. */
const MAX_FORECAST_DAYS = 16;

/** Days of real, already-elapsed weather to pull back — enough for the 5-day-back snow history plus a little slack. */
const PAST_DAYS = 5;

/** Minimum forward window so "next 5 days" is always covered, even for a same-day NOW request. */
const MIN_FORWARD_DAYS = 7;

const HOURLY_FIELDS = [
  'temperature_2m',
  'precipitation',
  'snowfall',
  'snow_depth',
  'precipitation_probability',
  'windspeed_10m',
  'windgusts_10m',
  'winddirection_10m',
  'cloudcover',
  'visibility',
  'freezinglevel_height',
] as const;

const DAILY_FIELDS = ['snowfall_sum'] as const;

/** The subset of the Open-Meteo response this provider actually reads. */
interface OpenMeteoResponse {
  hourly?: {
    time?: string[];
    temperature_2m?: number[];
    precipitation?: number[];
    snowfall?: number[];
    snow_depth?: number[];
    precipitation_probability?: number[];
    windspeed_10m?: number[];
    windgusts_10m?: number[];
    winddirection_10m?: number[];
    cloudcover?: number[];
    visibility?: number[];
    freezinglevel_height?: number[];
  };
  daily?: {
    time?: string[];
    snowfall_sum?: number[];
  };
}

export interface OpenMeteoWeatherOptions {
  /** Override for tests; production code never needs this. */
  baseUrl?: string;
  /** How long a fetched forecast should be trusted, in minutes. */
  freshnessMinutes?: number;
}

/**
 * Production weather via Open-Meteo.
 *
 * Open-Meteo needs no API key and serves CORS, so this calls the API directly
 * from the browser — there is no secret to protect and no server boundary to
 * build for this one. It supports an `elevation` override per request, which
 * is what lets a mid-mountain forecast point read colder than the valley
 * floor the same lat/lon would otherwise imply.
 *
 * The engine never sees any of this: it gets back the same `MountainWeather`
 * shape the demo provider produces, stamped `source: 'live'`.
 */
export class OpenMeteoWeatherProvider implements WeatherProvider {
  readonly id = 'open-meteo';

  constructor(private readonly options: OpenMeteoWeatherOptions = {}) {}

  async getMountainWeather(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<MountainWeather>> {
    if (context.horizonDays > MAX_FORECAST_DAYS) {
      return unavailable(
        this.id,
        `Open-Meteo only forecasts ${MAX_FORECAST_DAYS} days out; this date is ${context.horizonDays} days away.`,
      );
    }

    const url = this.buildUrl(mountain, context);

    let payload: OpenMeteoResponse;
    try {
      payload = await fetchJson<OpenMeteoResponse>(url, { timeoutMs: 8000 });
    } catch (error) {
      return unavailable(this.id, describeError(error));
    }

    const hourly = payload.hourly;
    if (
      !hourly?.time ||
      !hourly.temperature_2m ||
      !hourly.snowfall ||
      !hourly.windspeed_10m ||
      !hourly.windgusts_10m
    ) {
      return unavailable(this.id, 'Open-Meteo returned an incomplete hourly forecast.');
    }

    const targetHours: HourlyWeather[] = [];
    let overnightSnowIn = 0;
    let recentSnow72hIn = 0;
    let daysSinceStorm = 0;
    let foundStorm = false;

    const now = Date.now();
    const targetPrefix = context.date; // "YYYY-MM-DD"
    const dayBeforePrefix = shiftDatePrefix(context.date, -1);

    for (let i = hourly.time.length - 1; i >= 0; i -= 1) {
      const iso = hourly.time[i];
      if (!iso) continue;
      const snowCm = hourly.snowfall[i] ?? 0;
      const snowIn = snowCm / 2.54;

      // Trailing 72h from "now" (or from the target date if projecting ahead).
      const hourDate = new Date(iso).getTime();
      const referenceNow = context.horizonDays === 0 ? now : new Date(`${context.date}T12:00:00`).getTime();
      if (hourDate <= referenceNow && hourDate > referenceNow - 72 * HOUR * 60 * 1000) {
        recentSnow72hIn += snowIn;
      }

      // Overnight = between 6pm the day before and 6am of the target date.
      if (
        (iso.startsWith(dayBeforePrefix) && hourOf(iso) >= 18) ||
        (iso.startsWith(targetPrefix) && hourOf(iso) < 6)
      ) {
        overnightSnowIn += snowIn;
      }

      // Days-since-storm: walk backward from the target date's dawn.
      if (!foundStorm && iso <= `${targetPrefix}T06:00`) {
        if (snowIn > 0.05) {
          foundStorm = true;
          daysSinceStorm = 0;
        }
      }
    }

    if (!foundStorm) {
      // No snowfall found anywhere in the returned window at all — report the
      // honest bound of what we actually looked at rather than a fabricated
      // "it's been dry forever".
      daysSinceStorm = Math.max(1, Math.round((hourly.time.length - 1) / 24));
    } else if (overnightSnowIn > 0.05) {
      daysSinceStorm = 0;
    }

    for (const minute of minuteRange(FIRST_HOUR, LAST_HOUR, HOUR)) {
      const iso = localIsoFor(context.date, minute);
      const index = hourly.time.indexOf(iso);
      if (index === -1) continue;

      const tempF = celsiusToF(hourly.temperature_2m[index] ?? 0);
      const windMph = kmhToMph(hourly.windspeed_10m[index] ?? 0);
      const gustMph = kmhToMph(hourly.windgusts_10m[index] ?? windMph * 1.5);
      const cloudPct = hourly.cloudcover?.[index] ?? 50;
      const visibilityM = hourly.visibility?.[index] ?? 16000;
      const snowIn = (hourly.snowfall[index] ?? 0) / 2.54;

      const daylight = bell(minute, at(12, 30), 260);
      const sunFactor = clamp01((1 - cloudPct / 100) * (0.3 + 0.9 * daylight));

      targetHours.push({
        minute,
        snowfallIn: round2(snowIn),
        temperatureF: Math.round(tempF),
        windMph: Math.round(windMph),
        windGustMph: Math.round(gustMph),
        sunFactor: round2(sunFactor),
        visibility: round2(clamp01(visibilityM / 16000)),
        density: round2(estimateSnowDensity(tempF)),
        precipitationProbability: hourly.precipitation_probability?.[index],
        cloudCoverPct: hourly.cloudcover?.[index],
        windDirectionDeg: hourly.winddirection_10m?.[index],
        freezingLevelFt: hourly.freezinglevel_height
          ? Math.round((hourly.freezinglevel_height[index] ?? 0) * 3.28084)
          : undefined,
      });
    }

    if (targetHours.length === 0) {
      return unavailable(this.id, 'Open-Meteo did not return hours for the requested date.');
    }

    const fetchedAt = new Date();
    const freshnessMinutes =
      this.options.freshnessMinutes ?? (context.horizonDays === 0 ? 30 : 120);
    const validUntil = new Date(fetchedAt.getTime() + freshnessMinutes * 60 * 1000);

    // Base and peak are independent, elevation-specific requests: one failing
    // never takes the other down, and neither is allowed to borrow the
    // other's numbers.
    const [base, peak] = await Promise.all([
      this.fetchElevationPoint(mountain, context, mountain.elevations.baseFt, fetchedAt),
      this.fetchElevationPoint(mountain, context, mountain.elevations.summitFt, fetchedAt),
    ]);

    return ok(
      {
        overnightSnowIn: round1(overnightSnowIn),
        recentSnow72hIn: round1(recentSnow72hIn),
        daysSinceStorm,
        hourly: targetHours,
        summary: summarize(targetHours, daysSinceStorm),
        base,
        peak,
        snowHistory: buildSnowHistory(payload.daily, context.today),
      },
      {
        source: 'live',
        observation: observationForHorizon(context.horizonDays),
        confidence: confidenceForHorizon(context.horizonDays),
        provider: this.id,
        horizonDays: context.horizonDays,
        fetchedAt: fetchedAt.toISOString(),
        validUntil: validUntil.toISOString(),
      },
    );
  }

  private buildUrl(mountain: Mountain, context: ProviderContext): string {
    const base = this.options.baseUrl ?? BASE_URL;
    const { lat, lon } = mountain.weatherLocation.point;
    const elevationM = Math.round(mountain.weatherLocation.forecastElevationFt / 3.28084);
    const forecastDays = Math.min(MAX_FORECAST_DAYS, Math.max(MIN_FORWARD_DAYS, context.horizonDays + 2));

    const params = new URLSearchParams({
      latitude: lat.toFixed(4),
      longitude: lon.toFixed(4),
      elevation: String(elevationM),
      hourly: HOURLY_FIELDS.join(','),
      daily: DAILY_FIELDS.join(','),
      forecast_days: String(forecastDays),
      past_days: String(PAST_DAYS),
      timezone: 'auto',
      temperature_unit: 'celsius',
      windspeed_unit: 'kmh',
      precipitation_unit: 'mm',
    });

    return `${base}?${params.toString()}`;
  }

  /**
   * A minimal, single-elevation request for one point on the mountain: the
   * same coordinates, a different `elevation`, so Open-Meteo's own
   * elevation-downscaling does the work rather than a lapse-rate guess of
   * ours. Failure here is independent of the main forecast — it returns
   * `null`, never a copy of the other elevation's reading.
   */
  private async fetchElevationPoint(
    mountain: Mountain,
    context: ProviderContext,
    elevationFt: number,
    timestamp: Date,
  ): Promise<ElevationConditions | null> {
    try {
      const baseUrl = this.options.baseUrl ?? BASE_URL;
      const { lat, lon } = mountain.coordinates;
      const elevationM = Math.round(elevationFt / 3.28084);
      const forecastDays = Math.min(MAX_FORECAST_DAYS, Math.max(2, context.horizonDays + 2));

      const params = new URLSearchParams({
        latitude: lat.toFixed(4),
        longitude: lon.toFixed(4),
        elevation: String(elevationM),
        hourly: 'temperature_2m,windspeed_10m,windgusts_10m,snow_depth',
        forecast_days: String(forecastDays),
        timezone: 'auto',
        temperature_unit: 'celsius',
        windspeed_unit: 'kmh',
      });

      const payload = await fetchJson<OpenMeteoResponse>(`${baseUrl}?${params.toString()}`, {
        timeoutMs: 8000,
      });
      const hourly = payload.hourly;
      if (!hourly?.time || !hourly.temperature_2m || !hourly.windspeed_10m) return null;

      const anchorMinute = context.horizonDays === 0 ? roundDownToHour(context.now) : at(12);
      const anchorIso = localIsoFor(context.date, anchorMinute);
      let index = hourly.time.indexOf(anchorIso);
      if (index === -1) index = hourly.time.findIndex((iso) => iso.startsWith(context.date));
      if (index === -1) return null;

      const windMph = kmhToMph(hourly.windspeed_10m[index] ?? 0);
      const gustMph = kmhToMph(hourly.windgusts_10m?.[index] ?? windMph * 1.5);
      const depthM = hourly.snow_depth?.[index];

      return {
        temperatureF: Math.round(celsiusToF(hourly.temperature_2m[index] ?? 0)),
        windMph: Math.round(windMph),
        windGustMph: Math.round(gustMph),
        snowDepthIn: depthM === undefined || depthM === null ? null : round1(depthM * 39.3701),
        timestamp: timestamp.toISOString(),
        source: this.id,
      };
    } catch {
      return null;
    }
  }
}

/**
 * Five-day-back / five-day-forward snowfall from Open-Meteo's own daily
 * aggregate — not summed by hand from the hourly series, so it matches
 * whatever day-boundary convention the provider itself uses. Anchored to
 * `today`, not to whichever date is being planned: it describes the
 * mountain's snow cycle, independent of which day the user is looking at.
 */
function buildSnowHistory(daily: OpenMeteoResponse['daily'], today: DateKey): SnowHistory | null {
  if (!daily?.time || !daily.snowfall_sum) return null;
  const todayIndex = daily.time.indexOf(today);
  if (todayIndex === -1) return null;

  const dayAt = (offset: number, kind: DailySnowfall['kind']): DailySnowfall | null => {
    const index = todayIndex + offset;
    const date = daily.time?.[index];
    const cm = daily.snowfall_sum?.[index];
    if (date === undefined || cm === undefined || cm === null) return null;
    return { date, snowfallIn: round1(cm / 2.54), kind };
  };

  const past = [-5, -4, -3, -2, -1]
    .map((offset) => dayAt(offset, 'observed'))
    .filter((day): day is DailySnowfall => day !== null);
  const future = [1, 2, 3, 4, 5]
    .map((offset) => dayAt(offset, 'forecast'))
    .filter((day): day is DailySnowfall => day !== null);

  if (past.length === 0 && future.length === 0) return null;

  return {
    past,
    pastTotalIn: round1(past.reduce((sum, day) => sum + day.snowfallIn, 0)),
    future,
    futureTotalIn: round1(future.reduce((sum, day) => sum + day.snowfallIn, 0)),
  };
}

function roundDownToHour(minute: MinuteOfDay): MinuteOfDay {
  return Math.floor(minute / HOUR) * HOUR;
}

function describeError(error: unknown): string {
  if (error instanceof Error) return error.message;
  return 'Open-Meteo request failed.';
}

const celsiusToF = (c: number): number => c * 1.8 + 32;
const kmhToMph = (kmh: number): number => kmh * 0.621371;
const round1 = (value: number): number => Math.round(value * 10) / 10;
const round2 = (value: number): number => Math.round(value * 100) / 100;

/** "2026-01-17T09:00" — matches Open-Meteo's `timezone=auto` local timestamps. */
function localIsoFor(date: string, minute: MinuteOfDay): string {
  const hour = Math.floor(minute / HOUR);
  const min = minute % HOUR;
  return `${date}T${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function hourOf(iso: string): number {
  const match = /T(\d{2}):/.exec(iso);
  return match ? Number(match[1]) : 0;
}

function shiftDatePrefix(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function summarize(hourly: HourlyWeather[], daysSinceStorm: number): string {
  const totalSnow = hourly.reduce((sum, hour) => sum + hour.snowfallIn, 0);
  const peakGust = Math.max(...hourly.map((hour) => hour.windGustMph));
  const windNote = peakGust > 40 ? ' Strong wind through the day.' : '';
  if (totalSnow > 3) return `Active snow expected — around ${totalSnow.toFixed(1)}" through the day.${windNote}`;
  if (totalSnow > 0.3) return `Light snow expected.${windNote}`;
  if (daysSinceStorm <= 2) return `Between systems, mostly firm and fast.${windNote}`;
  return `Dry pattern. Groomers are the play.${windNote}`;
}
