import type { HourlyWeather, MountainWeather } from '@/domain/conditions';
import type { Mountain } from '@/domain/mountain';
import {
  type Availability,
  confidenceForHorizon,
  ok,
  observationForHorizon,
  unavailable,
} from '@/domain/provenance';
import { at, clamp, clamp01, HOUR, type MinuteOfDay } from '@/domain/time';
import { bell } from '@/lib/curve';
import type { ProviderContext, WeatherProvider } from '@/providers/types';
import { mountainRng, orographicFactor, profileFor, regionalPattern } from './scenario';

const FIRST_HOUR = at(4);
const LAST_HOUR = at(20);

export interface DemoWeatherOptions {
  /** Force this provider to report unavailable, to exercise the error state. */
  failFor?: (mountain: Mountain) => boolean;
}

/**
 * Forecasts get blurrier with lead time. Rather than pretend to precision we
 * do not have, long-horizon demo forecasts are pulled toward a climatological
 * mean — the same thing a real projected view should do.
 */
function climatologyBlend(horizonDays: number): number {
  if (horizonDays <= 2) return 0;
  return clamp((horizonDays - 2) / 12, 0, 0.7);
}

export class DemoWeatherProvider implements WeatherProvider {
  readonly id = 'demo-weather';

  constructor(private readonly options: DemoWeatherOptions = {}) {}

  async getMountainWeather(
    mountain: Mountain,
    context: ProviderContext,
  ): Promise<Availability<MountainWeather>> {
    if (this.options.failFor?.(mountain)) {
      return unavailable(this.id, 'No forecast returned for this location.');
    }

    const pattern = regionalPattern(context.date, context.horizonDays);
    const profile = profileFor(mountain.id);
    const oro = orographicFactor(mountain, pattern);
    const rng = mountainRng(mountain, context.date, 'weather');
    const blend = climatologyBlend(context.horizonDays);

    const snowMultiplier = profile.snow * oro;
    const overnightIn = mix(pattern.overnightIn * snowMultiplier, 2.4 * snowMultiplier, blend);
    const daytimeRate = mix(pattern.daytimeRateInPerHour * snowMultiplier, 0.18 * snowMultiplier, blend);
    const windScale = profile.wind * mix(1, 0.95, blend);

    const hourly: HourlyWeather[] = [];
    for (let minute = FIRST_HOUR; minute <= LAST_HOUR; minute += HOUR) {
      hourly.push(
        hourFor(minute, {
          daytimeRate,
          taper: pattern.stormTaperMinute,
          baseTempF: mix(pattern.baseTempF, 20, blend) + (10400 - mountain.weatherLocation.forecastElevationFt) / 320,
          diurnalRangeF: pattern.diurnalRangeF,
          windBaseMph: pattern.windBaseMph * windScale,
          sunBase: pattern.sunBase,
          density: pattern.density,
          jitter: rng.range(-0.12, 0.12),
        }),
      );
    }

    const provenance = {
      source: 'demo' as const,
      observation: observationForHorizon(context.horizonDays),
      confidence: confidenceForHorizon(context.horizonDays),
      provider: this.id,
      horizonDays: context.horizonDays,
    };

    return ok(
      {
        overnightSnowIn: round1(overnightIn),
        recentSnow72hIn: round1(mix(pattern.recentSnow72hIn * snowMultiplier, 9 * snowMultiplier, blend)),
        daysSinceStorm: pattern.daysSinceStorm,
        hourly,
        summary: pattern.summary,
      },
      provenance,
    );
  }
}

interface HourInputs {
  daytimeRate: number;
  taper: MinuteOfDay;
  baseTempF: number;
  diurnalRangeF: number;
  windBaseMph: number;
  sunBase: number;
  density: number;
  jitter: number;
}

function hourFor(minute: MinuteOfDay, input: HourInputs): HourlyWeather {
  // Snowfall tails off toward the taper time rather than stopping abruptly.
  const stormShare = minute >= input.taper ? 0 : clamp01((input.taper - minute) / 240);
  const snowfallIn = Math.max(0, input.daytimeRate * stormShare * (1 + input.jitter));

  // Coldest around dawn, warmest mid-afternoon.
  const warmth = bell(minute, at(14, 30), 260);
  const temperatureF = input.baseTempF + input.diurnalRangeF * warmth;

  // Wind builds through the day as the pressure gradient tightens.
  const windRamp = 0.75 + 0.5 * clamp01((minute - at(7)) / (at(16) - at(7)));
  const windMph = Math.max(0, input.windBaseMph * windRamp * (1 + input.jitter * 0.5));

  const snowing = snowfallIn > 0.05;
  const sunFactor = clamp01(input.sunBase * (snowing ? 0.25 : 1) * (0.35 + 0.9 * warmth));
  const visibility = clamp01(snowing ? 0.9 - snowfallIn * 0.45 : 0.94 + input.jitter * 0.1);

  return {
    minute,
    snowfallIn: round2(snowfallIn),
    temperatureF: Math.round(temperatureF),
    windMph: Math.round(windMph),
    windGustMph: Math.round(windMph * 1.55),
    sunFactor: round2(sunFactor),
    visibility: round2(clamp(visibility, 0.1, 1)),
    density: round2(input.density),
  };
}

const mix = (near: number, far: number, blend: number): number => near * (1 - blend) + far * blend;
const round1 = (value: number): number => Math.round(value * 10) / 10;
const round2 = (value: number): number => Math.round(value * 100) / 100;
