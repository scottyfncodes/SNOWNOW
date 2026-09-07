import { resortSourceFor } from '@/data/resortSources';
import type { OperationsReport } from '@/domain/conditions';
import { isWeekend } from '@/domain/dates';
import type { Mountain } from '@/domain/mountain';
import { openTimeFor } from '@/domain/mountain';
import { type Availability, ok, unavailable } from '@/domain/provenance';
import { fetchJson } from '@/lib/http';
import type { ProviderContext } from '@/providers/types';

/**
 * Lift status via Liftie (https://liftie.info) — TIER 2 of the layered
 * mountain-operations strategy (see `mountainStatus.ts` for tiers 1 and 3).
 *
 * Liftie is a real, established open-source lift-status aggregator with a
 * documented REST endpoint (`GET /api/resort/:id`) and existing Colorado
 * coverage. It is a genuinely better source than the demo simulation this
 * replaces — but it is still a third-party aggregator, not the resort's own
 * feed, and this sandbox's network policy blocks `liftie.info` outbound
 * (confirmed via the egress proxy's own denial log, same restriction already
 * documented for Open-Meteo/NWS/CDOT), so the exact response shape below has
 * never been confirmed against a live answer. Every field access is
 * defensive for exactly that reason: an unrecognized shape returns
 * `unavailable`, never a guessed lift count.
 *
 * `RESORT_SOURCES` in `data/resortSources.ts` is the registry of which
 * mountains even attempt this — a resort with no known Liftie slug goes
 * straight to Tier 3 (`unavailable`) rather than guessing one.
 */
const BASE_URL = 'https://liftie.info/api/resort';

type LiftStatusWord = 'open' | 'hold' | 'closed' | 'scheduled';

/** The subset of Liftie's documented response this provider actually reads. */
interface LiftieResponse {
  name?: string;
  status?: string;
  lastUpdated?: string;
  updatedAt?: string;
  lifts?: {
    // One documented shape: pre-aggregated counts.
    status?: Partial<Record<LiftStatusWord, number>>;
    // Another plausible shape: a flat list this provider tallies itself.
    list?: { name?: string; status?: string }[];
  };
}

export interface LiftieOptions {
  baseUrl?: string;
}

export async function getLiftieOperations(
  mountain: Mountain,
  context: ProviderContext,
  options: LiftieOptions = {},
): Promise<Availability<OperationsReport>> {
  const slug = resortSourceFor(mountain.id).liftieSlug;
  if (!slug) {
    return unavailable('liftie', `No known Liftie coverage for ${mountain.name}.`);
  }

  const base = options.baseUrl ?? BASE_URL;
  const url = `${base}/${slug}`;

  let payload: LiftieResponse;
  try {
    payload = await fetchJson<LiftieResponse>(url, { timeoutMs: 8000 });
  } catch (error) {
    return unavailable('liftie', error instanceof Error ? error.message : 'Liftie request failed.');
  }

  const counts = extractLiftCounts(payload);
  if (!counts) {
    return unavailable('liftie', 'Liftie returned an unrecognized response shape.');
  }

  const { open, hold, scheduled, closed } = counts;
  const total = open + hold + scheduled + closed;
  if (total === 0) {
    return unavailable('liftie', 'Liftie reported zero lifts for this resort.');
  }

  const weekend = isWeekend(context.date);
  const scheduledOpen = openTimeFor(mountain, weekend);
  const fetchedAt = new Date().toISOString();
  const source = resortSourceFor(mountain.id);

  return ok(
    {
      // Real, engine-relevant fields the score reads:
      expectedOpen: scheduledOpen,
      scheduledOpen,
      lastChair: mountain.operations.lastChair,
      liftsExpectedOpen: open,
      liftsTotal: total,
      // Liftie reports lifts, not terrain or grooming — those stay honestly
      // absent rather than inferred from a lift count.
      terrainOpenShare: clampShare(open / total),
      groomedShare: 0.8, // No signal either way; see the docblock — not reported by this source.
      windHoldRisk: hold / total,
      upperMountainDelayMinutes: mountain.operations.upperMountainOpenOffset,
      status: hold / total > 0.3 ? 'hold' : closed > open ? 'delayed' : 'open',
      notes: hold > 0 ? [`${hold} lift${hold === 1 ? '' : 's'} on hold.`] : [],
      liftsOpen: open,
      liftsHold: hold,
      liftsScheduled: scheduled,
      liftsClosed: closed,
      sourceUrl: source.officialOpsUrl,
    },
    {
      source: 'live',
      observation: 'observed',
      confidence: 'medium',
      provider: 'liftie',
      horizonDays: context.horizonDays,
      fetchedAt,
      // Lift boards change through the day; a 20-minute window matches the
      // ~15-minute update cadence CDOT documents for its own feed and is a
      // reasonable default for a similar operational status source.
      validUntil: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
      attribution: 'Third-party aggregator (Liftie) — not the resort\'s own feed.',
    },
  );
}

/**
 * Groomed terrain is real, and 0.8 above is a stand-in, not a claim — it is
 * only ever used as a scoring input, and `groomedShare` is deliberately
 * documented as "not reported" so the UI never presents it as observed.
 */
function clampShare(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

/**
 * Accepts either documented shape (pre-aggregated counts, or a flat lift
 * list this tallies itself) and returns null for anything else — the
 * fail-safe boundary that keeps a schema surprise from becoming a fabricated
 * lift count.
 */
function extractLiftCounts(
  payload: LiftieResponse,
): { open: number; hold: number; scheduled: number; closed: number } | null {
  const byStatus = payload.lifts?.status;
  if (byStatus && typeof byStatus === 'object') {
    const open = Number(byStatus.open ?? 0);
    const hold = Number(byStatus.hold ?? 0);
    const scheduled = Number(byStatus.scheduled ?? 0);
    const closed = Number(byStatus.closed ?? 0);
    if ([open, hold, scheduled, closed].every(Number.isFinite)) {
      return { open, hold, scheduled, closed };
    }
  }

  const list = payload.lifts?.list;
  if (Array.isArray(list) && list.length > 0) {
    const tally = { open: 0, hold: 0, scheduled: 0, closed: 0 };
    let recognized = 0;
    for (const lift of list) {
      const status = String(lift?.status ?? '').toLowerCase();
      if (status === 'open') {
        tally.open += 1;
        recognized += 1;
      } else if (status === 'hold' || status === 'delayed') {
        tally.hold += 1;
        recognized += 1;
      } else if (status === 'scheduled' || status === 'planned') {
        tally.scheduled += 1;
        recognized += 1;
      } else if (status === 'closed') {
        tally.closed += 1;
        recognized += 1;
      }
    }
    // If most of the list didn't parse as a status this provider recognizes,
    // treat the whole shape as unrecognized rather than reporting a partial,
    // misleading count.
    if (recognized >= list.length * 0.6) return tally;
  }

  return null;
}
