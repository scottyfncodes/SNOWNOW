import type { MountainProfile } from '@/domain/mountainProfile';
import { TBD_DATE } from '@/domain/mountainProfile';

/**
 * Researched from each resort's own public pages/press materials via web
 * search (see per-entry `notes`). This sandbox's outbound web access is
 * restricted the same way the CDOT/Liftie/Open-Meteo integrations are (see
 * providers/live/*), so none of these URLs could be fetch-verified to
 * actually resolve — they are real, indexed URLs from search results, never
 * invented, but a human with normal browser access should do a spot check
 * before leaning on this data for anything beyond display. Fields the
 * research could not confirm from an official (or, failing that, a clearly
 * reputable secondary) source are `null` rather than guessed.
 *
 * Opening/closing dates were researched in early September 2026, before the
 * 2026-27 season — most resorts had only a "target" date at that point, if
 * anything at all. Update this file as resorts confirm dates through the
 * season; nothing here should be treated as self-updating.
 */
export const MOUNTAIN_PROFILES: Record<string, MountainProfile> = {
  vail: {
    officialWebsite: 'https://www.vail.com',
    snowReportUrl: 'https://www.vail.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx',
    webcamUrl: 'https://www.vail.com/the-mountain/mountain-conditions/mountain-cams.aspx',
    trailMap: {
      officialUrl: 'https://www.vail.com/the-mountain/about-the-mountain/trail-map.aspx',
      source: 'official',
      // The only direct PDF search turned up (fy20/2019) is six seasons
      // stale — too old to present as "the" trail map even with a caveat,
      // so no imageUrl/pdfUrl/season here: honestly link to the official
      // page, which the resort itself keeps current, rather than embed a
      // years-old layout.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.vail.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '970-754-8245',
    address: 'P.O. Box 7, Vail, CO 81658',
    openingDate: { date: '2026-11-13', status: 'projected' },
    closingDate: TBD_DATE,
    notes:
      'Opening date is Vail Resorts’ own published 2026-27 "target" (8/18/2026 press release), not yet confirmed. Not fetch-verified — see module note.',
  },
  'beaver-creek': {
    officialWebsite: 'https://www.beavercreek.com',
    snowReportUrl: 'https://www.beavercreek.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
    webcamUrl: null,
    trailMap: {
      officialUrl: 'https://www.beavercreek.com/the-mountain/about-the-mountain/trail-map.aspx',
      source: 'official',
      // Only a 2022-23 PDF was confirmable (three seasons stale) — see vail's note above for the same reasoning.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.beavercreek.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '970-754-4636',
    address: '26 Avondale Lane, Avon, CO 81620',
    openingDate: { date: '2026-11-25', status: 'projected' },
    closingDate: TBD_DATE,
    notes:
      'Opening date per Vail Resorts’ 8/18/2026 press release. Webcam URL could not be confirmed from a distinct source and is left null rather than guessed from Vail’s page template. Not fetch-verified.',
  },
  breckenridge: {
    officialWebsite: 'https://www.breckenridge.com',
    snowReportUrl: 'https://www.breckenridge.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx',
    webcamUrl: 'https://www.breckenridge.com/the-mountain/mountain-conditions/mountain-cams.aspx',
    trailMap: {
      officialUrl: 'https://www.breckenridge.com/the-mountain/about-the-mountain/trail-map.aspx',
      source: 'official',
      // Newest confirmable PDF was 2023-24 (two seasons stale) — see vail's note above.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.breckenridge.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '970-453-5000',
    address: '1599 Summit County Rd, Ste 3, Breckenridge, CO 80424',
    openingDate: { date: '2026-11-06', status: 'projected' },
    closingDate: TBD_DATE,
    notes:
      'Opening date per Vail Resorts’ 8/18/2026 press release. Not fetch-verified.',
  },
  keystone: {
    officialWebsite: 'https://www.keystoneresort.com',
    snowReportUrl: 'https://www.keystoneresort.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx',
    webcamUrl: 'https://www.keystoneresort.com/the-mountain/mountain-conditions/mountain-cams.aspx',
    trailMap: {
      officialUrl: 'https://www.keystoneresort.com/the-mountain/about-the-mountain/trail-map.aspx',
      source: 'official',
      pdfUrl:
        'https://www.keystoneresort.com/-/aemasset/sitecore/keystone/maps/winter-2025-2026/20251028_KY_winter-trail_map_001.pdf',
      imageUrl: null,
      season: '2025-26',
    },
    ticketUrl: 'https://www.keystoneresort.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '855-603-0049',
    address: '22101 US Hwy 6, Keystone, CO 80435',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    notes:
      'Vail Resorts’ 8/18/2026 release says Keystone is targeting "as soon as possible in October 2026" with no specific date, so no date is recorded despite the target being real. Not fetch-verified.',
  },
  'crested-butte': {
    officialWebsite: 'https://www.skicb.com',
    snowReportUrl: 'https://www.skicb.com/the-mountain/mountain-conditions/lift-and-terrain-status.aspx',
    webcamUrl: 'https://www.skicb.com/the-mountain/mountain-conditions/mountain-cams.aspx',
    trailMap: {
      officialUrl: 'https://www.skicb.com/the-mountain/about-the-mountain/trail-maps.aspx',
      source: 'official',
      pdfUrl:
        'https://www.skicb.com/-/aemasset/sitecore/crested-butte/maps/winter-2025-2026/20251103_CB_winter-trail_map_001.pdf',
      imageUrl: null,
      season: '2025-26',
    },
    ticketUrl: 'https://www.skicb.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '970-251-7022',
    address: '12 Snowmass Rd, Crested Butte, CO 81225',
    openingDate: { date: '2026-11-25', status: 'projected' },
    closingDate: TBD_DATE,
    notes:
      'Opening date per Vail Resorts’ 8/18/2026 press release (one secondary source suggested Nov 23 instead — the press release date is treated as authoritative). Not fetch-verified.',
  },
  'winter-park': {
    officialWebsite: 'https://www.winterparkresort.com',
    snowReportUrl: 'https://www.winterparkresort.com/the-mountain/mountain-report',
    webcamUrl: 'https://www.winterparkresort.com/the-mountain/mountain-cams',
    trailMap: {
      officialUrl: 'https://www.winterparkresort.com/the-mountain/mountain-information/maps',
      source: 'official',
      pdfUrl: 'https://www.winterparkresort.com/-/media/winter-park/winter-2526/maps/25-26_wp_winter-trail-map-web.pdf',
      imageUrl: null,
      season: '2025-26',
    },
    ticketUrl: 'https://www.winterparkresort.com/tickets-and-passes',
    passInfoUrl: 'https://www.ikonpass.com',
    phone: '970-726-5514',
    address: '85 Parsenn Rd, Winter Park, CO 80482',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    notes:
      'Resort’s own materials describe 2026-27 opening as "as soon as possible" with no fixed date — recorded as TBD rather than turning that into an invented date. Not fetch-verified.',
  },
  purgatory: {
    // CORRECTED: the official Purgatory Ski Resort (Durango, CO) source is
    // purgatory.ski — confirmed via web search (multiple independent
    // results, including the resort's own trail-map PDFs and season-pass
    // page, resolve under this domain). A prior session had flagged
    // purgatoryresort.com as unconfirmed and kept it as a placeholder; that
    // domain is not this resort's current site and has been replaced.
    officialWebsite: 'https://www.purgatory.ski',
    snowReportUrl: 'https://www.purgatory.ski/mountain/weather-conditions-webcams/',
    webcamUrl: 'https://www.purgatory.ski/mountain/weather-conditions-webcams/',
    trailMap: {
      // No dedicated "trail map" landing page was confirmed distinct from
      // this — the PDF itself was found directly, so the mountain's general
      // conditions page (already used above) is the closest real "official
      // source" page to send a human to alongside the direct PDF.
      officialUrl: 'https://www.purgatory.ski/mountain/weather-conditions-webcams/',
      source: 'official',
      pdfUrl: 'https://www.purgatory.ski/wp-content/uploads/sites/2/2025/12/Purgatory_Winter25-26_TrailMap_Website.pdf',
      imageUrl: null,
      season: '2025-26',
    },
    ticketUrl: 'https://store.purgatory.ski/Calendar.aspx?Department=TICKET%3AWIN&Category=VARIABLE&Item=1DAY&Link=Lift+Tickets',
    passInfoUrl: 'https://www.purgatory.ski/mountain/season-passes/',
    phone: '970-247-9000',
    address: '#1 Skier Place, Durango, CO 81301',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    notes:
      'Researched via web search against purgatory.ski (this sandbox still cannot fetch-verify directly — see the module note). The trail-map PDF is dated for the 2025-26 season; check purgatory.ski for the current season’s map once posted. No 2026-27 opening date announced yet — the 2025-26 season ran Nov 28, 2025 to Mar 29, 2026, shown here only as prior-season context, never as this season’s date.',
  },
  copper: {
    officialWebsite: 'https://www.coppercolorado.com',
    snowReportUrl: 'https://www.coppercolorado.com/the-mountain/conditions-weather/snow-report/',
    webcamUrl: 'https://www.coppercolorado.com/the-mountain/webcams/',
    trailMap: {
      officialUrl: 'https://www.coppercolorado.com/the-mountain/trail-area-maps/winter-trail-map/',
      source: 'official',
      // The page itself was confirmed; no directly-linkable current-season image/PDF asset was.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.coppercolorado.com/lift-tickets/',
    passInfoUrl: 'https://www.coppercolorado.com/tickets-passes/season-passes/ikon-pass/',
    phone: '866-841-2481',
    address: null,
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    notes:
      'No 2026-27 opening date announced as of research. No officially confirmed street address surfaced (left null rather than guessed at the commonly-cited Copper Mountain, CO 80443). Not fetch-verified.',
  },
  'wolf-creek': {
    officialWebsite: 'https://wolfcreekski.com',
    snowReportUrl: 'https://wolfcreekski.com/mountain-report/',
    webcamUrl: 'https://wolfcreekski.com/webcams/',
    trailMap: {
      officialUrl: 'https://wolfcreekski.com/area-maps/',
      source: 'official',
      // Only a 2016-vintage hi-res PDF was confirmable — too old to present as current.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://wolfcreekski.com/lift-tickets/',
    passInfoUrl: null,
    phone: '970-264-5639',
    address: 'PO Box 2800, Pagosa Springs, CO 81147',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    notes:
      'Independent and famously snow-dependent — some seasons open in October on natural snowfall alone, but nothing published for 2026-27 yet. Address is the mailing address; the ski area itself has no separate street address. No confirmed pass-program URL (own independent pass, same page as tickets). Not fetch-verified.',
  },
  'arapahoe-basin': {
    officialWebsite: 'https://www.arapahoebasin.com',
    snowReportUrl: 'https://www.arapahoebasin.com/mountain/conditions-and-weather/',
    webcamUrl: 'https://www.arapahoebasin.com/mountain-cams/',
    trailMap: {
      officialUrl: 'https://www.arapahoebasin.com/trail-maps/',
      source: 'official',
      // Page confirmed (covers Frontside + The Beavers); no directly-linkable current-season asset confirmed.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.arapahoebasin.com/tickets/',
    passInfoUrl: 'https://www.ikonpass.com/en/destinations/arapahoe-basin',
    phone: '888-272-7246',
    address: '28194 Highway 6, Dillon, CO 80435',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    notes:
      'A-Basin’s own materials describe 2026-27 opening as explicitly TBD, pending sufficient snow. Not fetch-verified.',
  },
  loveland: {
    officialWebsite: 'https://www.skiloveland.com',
    snowReportUrl: 'https://www.skiloveland.com/conditions/',
    webcamUrl: 'https://skiloveland.com/webcams/',
    trailMap: {
      officialUrl: 'https://skiloveland.com/plan-your-trip/trail-maps/',
      source: 'official',
      // Only a long-standing (2015-dated) PDF was confirmable — too old to present as current.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.skiloveland.com/lift-tickets/',
    passInfoUrl: 'https://skiloveland.com/season-passes/',
    phone: '800-736-3754',
    address: 'PO Box 899, Georgetown, CO 80444',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    notes:
      'Resort materials describe targeting "mid-October to early November 2026" with snowmaking starting late September — vague, so recorded as TBD rather than an invented specific date. Independent (Powder Alliance reciprocity, not Epic/Ikon). Not fetch-verified.',
  },
  eldora: {
    officialWebsite: 'https://www.eldora.com',
    snowReportUrl: 'https://www.eldora.com/the-mountain/mountain-report/',
    webcamUrl: 'https://www.eldora.com/the-mountain/webcams/',
    trailMap: {
      officialUrl: 'https://www.eldora.com/the-mountain/maps/alpine-trail-map/',
      source: 'official',
      // Page confirmed; no directly-linkable current-season image/PDF asset confirmed.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.eldora.com/tickets-passes/lift-tickets/',
    passInfoUrl: 'https://www.eldora.com/ikon-pass/',
    phone: '303-440-8700',
    address: '2861 Eldora Ski Road #140, Nederland, CO 80466',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    notes:
      'No official 2026-27 opening date found (a Nov 27, 2026 figure appears only on a third-party aggregator’s algorithmic projection, not an Eldora announcement, so not recorded). Not fetch-verified.',
  },
  steamboat: {
    officialWebsite: 'https://www.steamboat.com',
    snowReportUrl: 'https://www.steamboat.com/the-mountain/mountain-report',
    webcamUrl: 'https://www.steamboat.com/the-mountain/live-cams',
    trailMap: {
      officialUrl: 'https://www.steamboat.com/the-mountain/trail-map',
      source: 'official',
      // Page confirmed (includes an interactive grooming/trail map); no directly-linkable static current-season asset confirmed.
      imageUrl: null,
      pdfUrl: null,
      season: null,
    },
    ticketUrl: 'https://www.steamboat.com/lift-tickets',
    passInfoUrl: 'https://www.steamboat.com/plan-your-trip/lift-tickets-ski-pass/ikon-pass',
    phone: '800-922-2722',
    address: '2305 Mt. Werner Circle, Steamboat Springs, CO 80487',
    openingDate: { date: '2026-11-20', status: 'projected' },
    closingDate: TBD_DATE,
    notes:
      'Nov 20, 2026 target is reported consistently by ski-trade outlets but could not be traced to a direct Alterra/Steamboat press release — a reputable secondary source, not a confirmed primary one, so treat with a little extra caution despite "projected" status. Not fetch-verified.',
  },
};

export const mountainProfileFor = (mountainId: string): MountainProfile | null =>
  MOUNTAIN_PROFILES[mountainId] ?? null;
