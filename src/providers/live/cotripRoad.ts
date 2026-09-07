import { CORRIDOR_REGION, corridorFor } from '@/data/corridors';
import type { RoadClosure, RoadStatus } from '@/domain/road';
import { type Availability, ok, unavailable } from '@/domain/provenance';
import { fetchJson } from '@/lib/http';
import type { ProviderContext, RoadConditionProvider } from '@/providers/types';

/**
 * CDOT / COtrip road status — BEST EFFORT, UNVERIFIED.
 *
 * ⚠️ This adapter is written against CDOT's publicly documented open-data
 * pattern (an ArcGIS FeatureServer query returning GeoJSON-ish features for
 * active incidents/closures), but this sandbox's network policy blocks
 * `maps.cdot.info` and `cotrip.org`, so the exact field names below have
 * never been confirmed against a live response. That is a materially
 * different risk than the rest of this file's design: if the schema is
 * wrong, `parseFeatures` below throws or returns nothing recognizable, and
 * this correctly falls through to `unavailable(...)` — it fails safe, it
 * does not fail into fabricated closures. Before relying on this in
 * production, hit the endpoint once by hand and adjust `parseFeatures` to
 * match what actually comes back.
 *
 * Because of that uncertainty, treat `roads` as the one live provider in this
 * project that is more a scaffold than a finished integration — see the
 * README's "Live Data Status" table.
 */
const DEFAULT_BASE_URL =
  'https://maps.cdot.info/arcgis/rest/services/Weather/CDOT_Full_Closure/FeatureServer/0/query';

interface ArcGisFeature {
  attributes?: Record<string, unknown>;
}

interface ArcGisResponse {
  features?: ArcGisFeature[];
  error?: { message?: string };
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

    const base = this.options.baseUrl ?? DEFAULT_BASE_URL;
    const params = new URLSearchParams({
      where: `1=1`,
      outFields: '*',
      f: 'json',
    });
    const url = `${base}?${params.toString()}`;

    let payload: ArcGisResponse;
    try {
      payload = await fetchJson<ArcGisResponse>(url, { timeoutMs: 8000 });
    } catch (error) {
      return unavailable(this.id, error instanceof Error ? error.message : 'CDOT request failed.');
    }

    if (payload.error) {
      return unavailable(this.id, payload.error.message ?? 'CDOT returned an error payload.');
    }
    if (!Array.isArray(payload.features)) {
      return unavailable(this.id, 'CDOT returned an unrecognized response shape.');
    }

    const closures = parseFeatures(payload.features, routeName);
    const corridor = corridorFor(corridorId);
    const sourceTimestamp = new Date().toISOString();

    return ok(
      {
        corridorId,
        condition: closures.length > 0 ? 'closed' : 'clear',
        closures,
        tractionLawInEffect: false,
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
        validUntil: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      },
    );
  }
}

/** Best-effort guess at which CDOT corridors map to our internal corridor ids. */
function guessRouteName(corridorId: string): string | null {
  const map: Record<string, string> = {
    'i70-west': 'I-70',
    'us40-berthoud': 'US 40',
    'us6-loveland': 'US 6',
    'us285-hoosier': 'US 285',
    'us24-buena-vista': 'US 24',
    'us50-monarch': 'US 50',
    'us550-durango': 'US 550',
    'us160-wolfcreek': 'US 160',
  };
  return map[corridorId] ?? null;
}

/**
 * Defensive parsing: real ArcGIS attribute keys are unconfirmed here (see the
 * module docblock). Every access is optional-chained and every unexpected
 * shape produces zero closures rather than a guessed one.
 */
function parseFeatures(features: ArcGisFeature[], routeName: string): RoadClosure[] {
  const closures: RoadClosure[] = [];
  for (const feature of features) {
    const attrs = feature.attributes;
    if (!attrs) continue;
    const route = String(attrs.Route ?? attrs.RouteName ?? attrs.HIGHWAY ?? '');
    if (!route.toUpperCase().includes(routeName.toUpperCase())) continue;

    closures.push({
      description: String(attrs.Description ?? attrs.EventDescription ?? 'Closure reported.'),
      location: String(attrs.Location ?? attrs.LocationDesc ?? route),
      startedAt: toIso(attrs.StartDate ?? attrs.CreateDate) ?? new Date().toISOString(),
      expectedClearBy: toIso(attrs.PlannedEndDate ?? attrs.EndDate),
    });
  }
  return closures;
}

function toIso(value: unknown): string | undefined {
  if (typeof value === 'number') return new Date(value).toISOString();
  if (typeof value === 'string' && value.length > 0) {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  }
  return undefined;
}
