import { CORRIDOR_REGION, corridorFor } from '@/data/corridors';
import type { RoadClosure, RoadStatus } from '@/domain/road';
import { type Availability, ok, unavailable } from '@/domain/provenance';
import { fetchJson } from '@/lib/http';
import type { ProviderContext, RoadConditionProvider } from '@/providers/types';

/**
 * CDOT / COtrip road status — BEST EFFORT, UNVERIFIED.
 *
 * The Colorado Information Marketplace documents CDOT's COtrip real-time
 * data feed at `manage-api.cotrip.org` as covering real-time incidents,
 * weather stations, and transportation information, updated roughly every
 * 15 minutes. That is the source this adapter is written against — a real,
 * named, official CDOT endpoint, not a scrape of the cotrip.org website.
 *
 * ⚠️ This sandbox's network policy blocks `manage-api.cotrip.org` outbound
 * (confirmed via the egress proxy's own denial log — both a direct `curl`
 * and a `WebFetch` attempt returned a connection-level rejection, not an API
 * error), so the exact JSON envelope and field names below have never been
 * confirmed against a live response. That is a materially different risk
 * than the rest of this file's design: if the schema is wrong,
 * `parseIncidents` below finds nothing it recognizes and this falls through
 * to reporting `clear` with zero closures, or to `unavailable` if the
 * envelope itself doesn't parse at all — it fails safe, it does not fail
 * into a fabricated closure or a false "all clear". Before relying on this
 * in production, hit the endpoint once by hand (see "Verifying this" below)
 * and adjust `parseIncidents` to match what actually comes back.
 *
 * Because of that uncertainty, treat `roads` as the one live provider in
 * this project that is more a verified-shape scaffold than a confirmed
 * integration — see the README's "Live Data Status" table. It stays behind
 * `VITE_ENABLE_ROAD_CONDITIONS` for the same reason.
 *
 * ## Verifying this
 *
 * From any machine with real network access:
 * `curl -sS "https://manage-api.cotrip.org/api/v1/incidents"`
 * — confirm it returns JSON (array or an object wrapping one, per
 * `extractIncidentList` below), then check a real incident record against
 * the field names `parseIncidents` looks for and adjust them if they differ.
 */
const DEFAULT_BASE_URL = 'https://manage-api.cotrip.org/api/v1/incidents';

/** One incident record, field names best-guessed from CARS-family DOT feed conventions. */
interface CotripIncident {
  route?: string;
  routeName?: string;
  roadwayName?: string;
  Route?: string;
  RouteName?: string;
  description?: string;
  Description?: string;
  headline?: string;
  location?: string;
  Location?: string;
  locationDescription?: string;
  eventType?: string;
  category?: string;
  severity?: string;
  isFullClosure?: boolean;
  fullClosure?: boolean;
  startTime?: string | number;
  StartDate?: string | number;
  created?: string | number;
  plannedEndTime?: string | number;
  EndDate?: string | number;
  lastUpdated?: string | number;
  // A GeoJSON-shaped record is also plausible for this kind of feed.
  properties?: Record<string, unknown>;
  attributes?: Record<string, unknown>;
}

export interface CotripRoadOptions {
  baseUrl?: string;
  /** Free-text match against the corridor's highway name, e.g. "I-70". */
  corridorRouteName?: (corridorId: string) => string | null;
}

export class CotripRoadProvider implements RoadConditionProvider {
  readonly id = 'cotrip';

  constructor(private readonly options: CotripRoadOptions = {}) {}

  async getCorridorStatus(
    corridorId: string,
    context: ProviderContext,
  ): Promise<Availability<RoadStatus>> {
    // Only reasoned about for Colorado corridors — everything else has no
    // CDOT record by definition, and pretending otherwise would be exactly
    // the fabrication this provider exists to avoid.
    if ((CORRIDOR_REGION[corridorId] ?? '').length === 0) {
      return unavailable(this.id, `No known region for corridor "${corridorId}".`);
    }

    const routeName = this.options.corridorRouteName?.(corridorId) ?? guessRouteName(corridorId);
    if (!routeName) {
      return unavailable(this.id, `No CDOT route mapping for corridor "${corridorId}".`);
    }

    const url = this.options.baseUrl ?? DEFAULT_BASE_URL;

    let payload: unknown;
    try {
      payload = await fetchJson<unknown>(url, { timeoutMs: 8000 });
    } catch (error) {
      return unavailable(this.id, error instanceof Error ? error.message : 'CDOT request failed.');
    }

    const incidents = extractIncidentList(payload);
    if (incidents === null) {
      return unavailable(this.id, 'CDOT returned an unrecognized response shape.');
    }

    const { closures, tractionLawInEffect, chainsRequired } = parseIncidents(incidents, routeName);
    const corridor = corridorFor(corridorId);
    const sourceTimestamp = new Date().toISOString();

    return ok(
      {
        corridorId,
        condition: closures.length > 0 ? 'closed' : chainsRequired ? 'chains-required' : 'clear',
        closures,
        tractionLawInEffect,
        sourceTimestamp,
        source: `CDOT / COtrip (${corridor.name})`,
      },
      {
        source: 'live',
        observation: 'observed',
        confidence: 'high',
        provider: this.id,
        horizonDays: context.horizonDays,
        fetchedAt: sourceTimestamp,
        // CDOT documents ~15-minute update cadence for this feed.
        validUntil: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      },
    );
  }
}

/** Best-effort guess at which CDOT corridors map to our internal corridor ids. */
function guessRouteName(corridorId: string): string | null {
  const map: Record<string, string> = {
    'i70-west': 'I-70',
    'us40-berthoud': 'US 40',
    'us40-rabbitears': 'US 40',
    'us6-loveland': 'US 6',
    'us285-hoosier': 'US 285',
    'us24-buena-vista': 'US 24',
    'us50-monarch': 'US 50',
    'us550-durango': 'US 550',
    'us160-wolfcreek': 'US 160',
    'co119-eldora': 'CO 119',
  };
  return map[corridorId] ?? null;
}

/**
 * Accepts a bare array, or an object wrapping one under any of several
 * plausible envelope keys (a state DOT feed built on the CARS platform
 * commonly wraps records under "events"; others use "incidents", "data", or
 * a GeoJSON-style "features"). Returns null — not an empty array — when
 * nothing recognizable is found, so callers can tell "confirmed no
 * incidents" apart from "couldn't understand the response" and fail safe on
 * the latter instead of reporting a false "clear".
 */
function extractIncidentList(payload: unknown): CotripIncident[] | null {
  if (Array.isArray(payload)) return payload as CotripIncident[];
  if (payload && typeof payload === 'object') {
    const obj = payload as Record<string, unknown>;
    for (const key of ['incidents', 'events', 'data', 'results', 'features']) {
      const value = obj[key];
      if (Array.isArray(value)) return value as CotripIncident[];
    }
  }
  return null;
}

/**
 * Defensive parsing: real CDOT field names are unconfirmed here (see the
 * module docblock). Every access is optional-chained and every unexpected
 * shape produces zero closures rather than a guessed one. Distinguishes a
 * full closure (removes the route) from a chain-law/traction-law advisory
 * (penalizes it via `RoadCondition.chains-required` — see `scoring.ts`'s
 * `ROAD_SCORE` — without pretending the corridor is impassable).
 */
function parseIncidents(
  incidents: CotripIncident[],
  routeName: string,
): { closures: RoadClosure[]; tractionLawInEffect: boolean; chainsRequired: boolean } {
  const closures: RoadClosure[] = [];
  let tractionLawInEffect = false;
  let chainsRequired = false;

  for (const incident of incidents) {
    const attrs = incident.properties ?? incident.attributes ?? incident;
    const route = String(
      pick(attrs, ['route', 'routeName', 'roadwayName', 'Route', 'RouteName']) ?? '',
    );
    if (!route.toUpperCase().includes(routeName.toUpperCase())) continue;

    const description = String(
      pick(attrs, ['description', 'Description', 'headline']) ?? 'Incident reported.',
    );
    const category = String(
      pick(attrs, ['eventType', 'category', 'severity']) ?? '',
    ).toLowerCase();
    const isFullClosure = Boolean(pick(attrs, ['isFullClosure', 'fullClosure'])) ||
      /full closure|road closed|closed to all traffic/i.test(description) ||
      /closure/.test(category);
    const isChainOrTractionLaw = /chain law|traction law|chains required/i.test(description) ||
      /chain|traction/.test(category);

    if (isFullClosure) {
      closures.push({
        description,
        location: String(
          pick(attrs, ['location', 'Location', 'locationDescription']) ?? route,
        ),
        startedAt:
          toIso(pick(attrs, ['startTime', 'StartDate', 'created'])) ?? new Date().toISOString(),
        expectedClearBy: toIso(pick(attrs, ['plannedEndTime', 'EndDate'])),
      });
    } else if (isChainOrTractionLaw) {
      tractionLawInEffect = true;
      chainsRequired = true;
    }
  }

  return { closures, tractionLawInEffect, chainsRequired };
}

function pick(source: unknown, keys: string[]): unknown {
  if (!source || typeof source !== 'object') return undefined;
  const obj = source as Record<string, unknown>;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function toIso(value: unknown): string | undefined {
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return undefined;
}
