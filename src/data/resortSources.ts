/**
 * Where to look for each resort's live operational/pricing data, and where a
 * human can go check it themselves.
 *
 * This is a registry, not code: adding or fixing a resort's source is a data
 * change here, not a new branch in a provider. Every URL is a stable, public
 * page/endpoint a person could open in a browser — nothing here is a scraped
 * selector or an internal API key.
 *
 * Confidence is explicit per field because it varies resort to resort: a
 * Liftie slug guessed from the project's public resort list is a real,
 * reasonable attempt, not a confirmed one (this sandbox cannot reach
 * liftie.info to check — see providers/live/liftieOperations.ts). Where a
 * resort has no known Liftie coverage at all, its slug is left unset rather
 * than guessed, so the provider goes straight to `unavailable` instead of
 * wasting a request on a slug invented with no basis.
 */
export interface ResortSource {
  /**
   * The resort's own lift-status / mountain-conditions page. Always a
   * best-effort real URL when set — never omitted just because the exact
   * live data path underneath it is unverified.
   */
  officialOpsUrl?: string;
  /** The resort's own ticket-purchase page. */
  officialPurchaseUrl?: string;
  /**
   * Liftie (https://liftie.info) resort slug, if this resort is believed to
   * be one of the ones Liftie's open-source adapter list covers. Liftie is a
   * third-party aggregator, never the resort itself — see
   * `Provenance.attribution` on anything sourced through it.
   */
  liftieSlug?: string;
}

export const RESORT_SOURCES: Record<string, ResortSource> = {
  vail: {
    officialOpsUrl: 'https://www.vail.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
    officialPurchaseUrl: 'https://www.vail.com/plan-your-trip/lift-tickets.aspx',
    liftieSlug: 'vail',
  },
  'beaver-creek': {
    officialOpsUrl: 'https://www.beavercreek.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
    officialPurchaseUrl: 'https://www.beavercreek.com/plan-your-trip/lift-tickets.aspx',
    liftieSlug: 'beavercreek',
  },
  breckenridge: {
    officialOpsUrl: 'https://www.breckenridge.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
    officialPurchaseUrl: 'https://www.breckenridge.com/plan-your-trip/lift-tickets.aspx',
    liftieSlug: 'breckenridge',
  },
  keystone: {
    officialOpsUrl: 'https://www.keystoneresort.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
    officialPurchaseUrl: 'https://www.keystoneresort.com/plan-your-trip/lift-tickets.aspx',
    liftieSlug: 'keystone',
  },
  'crested-butte': {
    officialOpsUrl: 'https://www.skicb.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
    officialPurchaseUrl: 'https://www.skicb.com/plan-your-trip/lift-tickets.aspx',
    liftieSlug: 'crested-butte',
  },
  'winter-park': {
    officialOpsUrl: 'https://www.winterparkresort.com/the-mountain/mountain-report',
    officialPurchaseUrl: 'https://www.winterparkresort.com/tickets-and-passes',
    liftieSlug: 'winter-park',
  },
  copper: {
    officialOpsUrl: 'https://www.coppercolorado.com/mountain-report',
    officialPurchaseUrl: 'https://www.coppercolorado.com/lift-tickets',
    liftieSlug: 'copper',
  },
  purgatory: {
    officialOpsUrl: 'https://www.purgatoryresort.com/mountain/mountain-report/',
    officialPurchaseUrl: 'https://www.purgatoryresort.com/lift-tickets/',
    // Purgatory's small-independent status makes Liftie coverage genuinely
    // uncertain — left unset rather than guessed. See "Tier 3" in the module
    // docblock: this resort is expected to land on `unavailable` today.
  },
  'wolf-creek': {
    officialOpsUrl: 'https://wolfcreekski.com/mountain-report/',
    officialPurchaseUrl: 'https://wolfcreekski.com/lift-tickets/',
    // Same reasoning as Purgatory — independent, small, no confirmed Liftie coverage.
  },
  'arapahoe-basin': {
    officialOpsUrl: 'https://www.arapahoebasin.com/mountain/conditions-and-weather/',
    officialPurchaseUrl: 'https://www.arapahoebasin.com/tickets/',
    liftieSlug: 'arapahoe-basin',
  },
  loveland: {
    officialOpsUrl: 'https://www.skiloveland.com/conditions/',
    officialPurchaseUrl: 'https://www.skiloveland.com/lift-tickets/',
    liftieSlug: 'loveland',
  },
  eldora: {
    officialOpsUrl: 'https://www.eldora.com/the-mountain/mountain-report/',
    officialPurchaseUrl: 'https://www.eldora.com/tickets-passes/lift-tickets/',
    liftieSlug: 'eldora',
  },
  steamboat: {
    officialOpsUrl: 'https://www.steamboat.com/the-mountain/mountain-report',
    officialPurchaseUrl: 'https://www.steamboat.com/lift-tickets',
    liftieSlug: 'steamboat',
  },
  monarch: {
    officialOpsUrl: 'https://skimonarch.com/conditions/',
    officialPurchaseUrl: 'https://skimonarch.com/tickets/',
    // Confirmed real coverage — liftie.info/resort/monarch lists Monarch's
    // actual named lifts (Breezeway, Caterpillar, Garfield, Panorama,
    // Pioneer, Safari, Tomichi), not a guessed slug.
    liftieSlug: 'monarch',
  },
  telluride: {
    officialOpsUrl: 'https://tellurideskiresort.com/lifts/',
    officialPurchaseUrl: 'https://shop.tellurideskiresort.com/s/passes-and-tickets/winter-lift-tickets/',
    // Confirmed real coverage — liftie.info/resort/telluride is a real,
    // indexed page, not a guessed slug.
    liftieSlug: 'telluride',
  },
};

export const resortSourceFor = (mountainId: string): ResortSource => RESORT_SOURCES[mountainId] ?? {};
