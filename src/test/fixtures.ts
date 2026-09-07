import type {
  CrowdCurve,
  HourlyWeather,
  MountainWeather,
  OperationsReport,
  RoadCondition,
  TravelCurve,
} from '@/domain/conditions';
import type { WeatherAlert } from '@/domain/alerts';
import type { Mountain, Origin } from '@/domain/mountain';
import type { TicketPrice } from '@/domain/pricing';
import { type Availability, ok, unavailable, type Provenance } from '@/domain/provenance';
import type { RoadStatus } from '@/domain/road';
import { at, HOUR, minuteRange, type MinuteOfDay } from '@/domain/time';
import type { DayInputs } from '@/engine/inputs';

/**
 * Hand-built inputs for engine tests.
 *
 * The engine is tested against fixtures rather than the demo providers on
 * purpose: a test that fails because the demo weather changed would be telling
 * us nothing about the optimiser.
 */

export const PROVENANCE: Provenance = {
  source: 'demo',
  observation: 'observed',
  confidence: 'high',
  provider: 'fixture',
  horizonDays: 0,
};

export const TEST_ORIGIN: Origin = {
  id: 'home',
  name: 'Test City',
  shortName: 'Test City',
  coordinates: { lat: 39.7, lon: -105 },
};

export function testMountain(overrides: Partial<Mountain> = {}): Mountain {
  return {
    id: 'test-mtn',
    name: 'Test Mountain',
    shortName: 'TEST',
    region: 'Test Range',
    snowRegion: 'test-region',
    state: 'CO',
    country: 'US',
    coordinates: { lat: 39.5, lon: -106 },
    elevations: { baseFt: 9000, summitFt: 12000, verticalFt: 3000 },
    operations: {
      weekdayOpen: at(8, 30),
      weekendOpen: at(8, 30),
      lastChair: at(16, 0),
      upperMountainOpenOffset: 20,
    },
    lifts: { total: 20, highSpeed: 10, windExposed: 5 },
    terrain: { trails: 100, acres: 2000, aboveTreelineShare: 0.3, lateOpeningShare: 0.2 },
    weatherLocation: {
      point: { lat: 39.5, lon: -106 },
      forecastElevationFt: 10500,
      aspect: 'divide',
    },
    accessRoutes: [
      {
        id: 'test-route',
        originId: 'home',
        label: 'Test Highway',
        corridorId: 'test-corridor',
        originPoint: TEST_ORIGIN.coordinates,
        destinationPoint: { lat: 39.5, lon: -106 },
        distanceMiles: 80,
        freeFlowMinutes: 90,
        stormPenaltyMinutes: 10,
        weatherSensitivity: 0.5,
        isPrimary: true,
      },
    ],
    passAffiliations: ['epic'],
    popularity: 0.7,
    character: 'A mountain used only by tests.',
    ...overrides,
  };
}

export interface WeatherSpec {
  overnightSnowIn?: number;
  /** Inches per hour falling, by hour, until `snowUntil`. */
  daytimeRateInPerHour?: number;
  snowUntil?: MinuteOfDay;
  temperatureF?: number;
  windMph?: number;
  visibility?: number;
  daysSinceStorm?: number;
  density?: number;
}

export function testWeather(spec: WeatherSpec = {}): MountainWeather {
  const {
    overnightSnowIn = 0,
    daytimeRateInPerHour = 0,
    snowUntil = at(9),
    temperatureF = 20,
    windMph = 8,
    visibility = 0.95,
    daysSinceStorm = overnightSnowIn > 1 ? 0 : 4,
    density = 0.075,
  } = spec;

  const hourly: HourlyWeather[] = minuteRange(at(4), at(20), HOUR).map((minute) => ({
    minute,
    snowfallIn: minute < snowUntil ? daytimeRateInPerHour : 0,
    temperatureF,
    windMph,
    windGustMph: Math.round(windMph * 1.5),
    sunFactor: 0.4,
    visibility,
    density,
  }));

  return {
    overnightSnowIn,
    recentSnow72hIn: overnightSnowIn + 3,
    daysSinceStorm,
    hourly,
    summary: 'Fixture weather.',
  };
}

export function testOperations(overrides: Partial<OperationsReport> = {}): OperationsReport {
  return {
    expectedOpen: at(8, 30),
    scheduledOpen: at(8, 30),
    lastChair: at(16, 0),
    liftsExpectedOpen: 18,
    liftsTotal: 20,
    terrainOpenShare: 0.9,
    groomedShare: 0.8,
    windHoldRisk: 0.1,
    upperMountainDelayMinutes: 20,
    status: 'open',
    notes: [],
    ...overrides,
  };
}

export function testTicket(adultDay = 179, windowRate = 229): TicketPrice {
  return {
    mountainId: 'test-mtn',
    date: '2026-01-17',
    currency: 'USD',
    adultDay,
    windowRate,
    kind: 'window',
    purchasedDaysAhead: 0,
    note: 'Fixture pricing.',
  };
}

export function testAlert(overrides: Partial<WeatherAlert> = {}): WeatherAlert {
  return {
    id: 'fixture-alert-1',
    event: 'Winter Storm Warning',
    headline: 'Winter Storm Warning in effect',
    severity: 'severe',
    effective: '2026-01-17T00:00:00Z',
    expires: '2026-01-18T00:00:00Z',
    areaDesc: 'Summit County',
    source: 'fixture',
    ...overrides,
  };
}

export function testRoadStatus(overrides: Partial<RoadStatus> = {}): RoadStatus {
  return {
    corridorId: 'test-corridor',
    condition: 'clear',
    closures: [],
    tractionLawInEffect: false,
    sourceTimestamp: '2026-01-17T05:00:00Z',
    source: 'fixture',
    ...overrides,
  };
}

export function testCrowds(level = 0.4): CrowdCurve {
  return {
    samples: minuteRange(at(7), at(17), 15).map((minute) => ({ minute, crowding: level })),
    dayFactor: level * 2,
    drivers: ['Fixture'],
  };
}

export interface TravelSpec {
  direction: 'outbound' | 'return';
  /** Duration in minutes at each departure minute. */
  duration: (departure: MinuteOfDay) => number;
  from?: MinuteOfDay;
  to?: MinuteOfDay;
  step?: number;
  roadCondition?: RoadCondition;
  /** Congestion 0..1, defaults to a flat 0.1. */
  congestion?: (departure: MinuteOfDay) => number;
}

export function testTravel(spec: TravelSpec): TravelCurve {
  const {
    direction,
    duration,
    from = direction === 'outbound' ? at(3, 30) : at(10, 0),
    to = direction === 'outbound' ? at(12, 0) : at(21, 0),
    step = 6,
    roadCondition = 'clear',
    congestion = () => 0.1,
  } = spec;

  return {
    routeId: `fixture-${direction}`,
    routeLabel: 'Test Highway',
    corridorShorthand: 'TEST',
    distanceMiles: 80,
    direction,
    samples: minuteRange(from, to, step).map((departure) => ({
      departure,
      durationMinutes: Math.round(duration(departure)),
      congestion: Math.round(congestion(departure) * 100) / 100,
    })),
    roadCondition,
    incidents: [],
  };
}

export interface InputsSpec {
  mountain?: Mountain;
  weather?: MountainWeather | 'unavailable';
  operations?: OperationsReport | 'unavailable';
  crowds?: CrowdCurve | 'unavailable';
  ticket?: TicketPrice | 'unavailable';
  alerts?: WeatherAlert[] | 'unavailable';
  outbound?: TravelCurve | 'unavailable';
  inbound?: TravelCurve | 'unavailable';
  closedCorridors?: string[];
  date?: string;
  horizonDays?: number;
}

const wrap = <T,>(value: T | 'unavailable', reason: string): Availability<T> =>
  value === 'unavailable' ? unavailable<T>('fixture', reason) : ok(value as T, PROVENANCE);

export function testInputs(spec: InputsSpec = {}): DayInputs {
  const mountain = spec.mountain ?? testMountain();
  const outbound = spec.outbound ?? testTravel({ direction: 'outbound', duration: () => 100 });
  const inbound = spec.inbound ?? testTravel({ direction: 'return', duration: () => 100 });

  return {
    mountain,
    origin: TEST_ORIGIN,
    date: spec.date ?? '2026-01-17',
    horizonDays: spec.horizonDays ?? 0,
    isToday: (spec.horizonDays ?? 0) === 0,
    weather: wrap(spec.weather ?? testWeather(), 'No forecast.'),
    operations: wrap(spec.operations ?? testOperations(), 'No lift report.'),
    crowds: wrap(spec.crowds ?? testCrowds(), 'No crowd data.'),
    ticket: wrap(spec.ticket ?? testTicket(), 'No ticket pricing.'),
    alerts: wrap(spec.alerts ?? [], 'No alert feed.'),
    outbound: wrap(outbound, 'No route data.'),
    inbound: wrap(inbound, 'No route data.'),
    outboundOptions: outbound === 'unavailable' ? [] : [outbound],
    inboundOptions: inbound === 'unavailable' ? [] : [inbound],
    routes: mountain.accessRoutes,
    closedCorridors: spec.closedCorridors ?? [],
    usingDemoData: true,
  };
}
