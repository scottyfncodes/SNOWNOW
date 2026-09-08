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

export interface MountainProfile {
  officialWebsite: string;
  /** `null` when no official snow-report page could be confirmed distinct from `officialWebsite`. */
  snowReportUrl: string | null;
  webcamUrl: string | null;
  trailMapUrl: string | null;
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
