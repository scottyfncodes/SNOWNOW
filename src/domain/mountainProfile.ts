/**
 * The mountain's descriptive profile — official links, contact info, and
 * season dates. Deliberately kept separate from `resortSources.ts` (which
 * feeds live-data providers) and from anything live/operational: this module
 * is static-ish reference data a human could bookmark, not something scoring
 * or the snow clock ever reads.
 *
 * See domain/plan.ts's layering note for the full picture:
 *   STATIC PROFILE   → this file's website/address/phone/trailMap/pass URLs
 *   SEASONAL PROFILE → this file's openingDate/closingDate
 *   LIVE CONDITIONS  → providers/live/* (snow, weather, lifts, alerts)
 *   LIVE ROUTING     → engine/routing.ts + providers/live/googleRoutesTraffic.ts
 */

/** How firm a published season date is. Never inferred from history — only what the resort actually said. */
export type SeasonDateStatus = 'confirmed' | 'projected' | 'tbd';

export interface SeasonDate {
  /** ISO date, or `null` when the resort hasn't given one specific enough to record. */
  date: string | null;
  status: SeasonDateStatus;
}

export const TBD_DATE: SeasonDate = { date: null, status: 'tbd' };

/**
 * The mountain's official trail map — structured so the UI never has a
 * hard-coded URL to reach for. `officialUrl` is always the resort's own
 * trail-map page (or, failing that, its site) and is what "Official Trail
 * Map ↗" always opens, regardless of whether an embeddable asset exists.
 *
 * `imageUrl`/`pdfUrl` are only ever set when a specific, directly-linkable
 * official asset was found *and* could be confirmed as the current (or
 * near-current) season — see `data/mountainProfiles.ts`'s research notes.
 * A resort whose only confirmed asset was several seasons stale gets
 * `officialUrl` alone rather than an outdated map presented as current:
 * the UI's honest "trail map unavailable to preview — view official" state
 * exists precisely for this case, not just for a missing URL.
 */
export interface TrailMap {
  /** A directly-linkable official image (JPG/PNG/etc), when one was confirmed. */
  imageUrl?: string | null;
  /** A directly-linkable official PDF, when one was confirmed. */
  pdfUrl?: string | null;
  /** The resort's own trail-map page — always present, always where "Official Trail Map ↗" points. */
  officialUrl: string;
  /** Always 'official' — this app never links a third-party trail-map repository as if it were the resort's own. */
  source: 'official';
  /** e.g. "2025-26". `null`/omitted when the asset's season couldn't be confirmed — never guessed. */
  season?: string | null;
}

export interface MountainProfile {
  officialWebsite: string;
  /** `null` when no official snow-report page could be confirmed distinct from `officialWebsite`. */
  snowReportUrl: string | null;
  webcamUrl: string | null;
  trailMap: TrailMap;
  ticketUrl: string | null;
  /** `null` when no separate pass-info page exists (same as `ticketUrl`, or the resort has no pass product). */
  passInfoUrl: string | null;
  phone: string | null;
  address: string | null;
  openingDate: SeasonDate;
  closingDate: SeasonDate;
  /** Provenance/uncertainty notes — never shown as fact, only as a caveat for whoever maintains this data. */
  notes?: string;
}
