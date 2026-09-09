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
 * `parking` notes are the same kind of research, not a live feed (see
 * `domain/mountainProfile.ts#ParkingInfo`): which lots are free vs. paid,
 * when a reservation is actually required, and when to show up before a lot
 * fills — the logistics a skier plans around, sourced from each resort's own
 * parking page as of September 2026. Prices, hours, and reservation
 * requirements change season to season and sometimes mid-season (Steamboat
 * and Eldora both changed parking policy within the 2025-26 season alone) —
 * treat every note as a starting point to confirm, not a guarantee.
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
    trailMapUrl: 'https://www.vail.com/the-mountain/about-the-mountain/trail-map.aspx',
    ticketUrl: 'https://www.vail.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '970-754-8245',
    address: 'P.O. Box 7, Vail, CO 81658',
    openingDate: { date: '2026-11-13', status: 'projected' },
    closingDate: TBD_DATE,
    parking: {
      infoUrl: 'https://www.vail.gov/parking',
      reservationRequired: false,
      note: 'Free After 3 at the Vail Village and Lionshead structures (3pm–4am); Ford, Soccer, and Red Sandstone lots are free but reserved for employees and Premium pass holders. Structures fill on weekends and holidays, so arrive early or plan to pay.',
    },
    notes:
      'Opening date is Vail Resorts’ own published 2026-27 "target" (8/18/2026 press release), not yet confirmed. Not fetch-verified — see module note.',
  },
  'beaver-creek': {
    officialWebsite: 'https://www.beavercreek.com',
    snowReportUrl: 'https://www.beavercreek.com/the-mountain/mountain-conditions/terrain-and-lift-status.aspx',
    webcamUrl: null,
    trailMapUrl: null,
    ticketUrl: 'https://www.beavercreek.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '970-754-4636',
    address: '26 Avondale Lane, Avon, CO 81620',
    openingDate: { date: '2026-11-25', status: 'projected' },
    closingDate: TBD_DATE,
    parking: {
      infoUrl: 'https://www.beavercreek.com/travel-guide/where-to-park-at-beaver-creek.aspx',
      reservationRequired: false,
      note: 'Elk and Bear lots are free after 1pm (paid before then) with a free shuttle into the Village; village garages are free for 4 hours after 4pm. Ford Hall and Villa Montane garages are paid any time.',
    },
    notes:
      'Opening date per Vail Resorts’ 8/18/2026 press release. Webcam/trail-map URLs could not be confirmed from a distinct source and are left null rather than guessed from Vail’s page template. Not fetch-verified.',
  },
  breckenridge: {
    officialWebsite: 'https://www.breckenridge.com',
    snowReportUrl: 'https://www.breckenridge.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx',
    webcamUrl: 'https://www.breckenridge.com/the-mountain/mountain-conditions/mountain-cams.aspx',
    trailMapUrl: null,
    ticketUrl: 'https://www.breckenridge.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '970-453-5000',
    address: '1599 Summit County Rd, Ste 3, Breckenridge, CO 80424',
    openingDate: { date: '2026-11-06', status: 'projected' },
    closingDate: TBD_DATE,
    parking: {
      infoUrl: 'https://www.breckpark.com/reservenski',
      reservationRequired: false,
      note: 'Paid-lot reservations (North Gondola, Peak 9, Stables) are available in advance through the Reserve \'N Ski app, but not required. The free Skier Shuttle Lot on McCain Dr runs 6am–11pm, first-come, with bus service to the base. Arrive before 8am on weekends and holidays — lots fill fast.',
    },
    notes:
      'Opening date per Vail Resorts’ 8/18/2026 press release. Trail-map URL could not be confirmed from a distinct source and is left null. Not fetch-verified.',
  },
  keystone: {
    officialWebsite: 'https://www.keystoneresort.com',
    snowReportUrl: 'https://www.keystoneresort.com/the-mountain/mountain-conditions/snow-and-weather-report.aspx',
    webcamUrl: 'https://www.keystoneresort.com/the-mountain/mountain-conditions/mountain-cams.aspx',
    trailMapUrl: null,
    ticketUrl: 'https://www.keystoneresort.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '855-603-0049',
    address: '22101 US Hwy 6, Keystone, CO 80435',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    parking: {
      infoUrl: 'https://www.keystoneresort.com/travel-guide/where-to-park-at-keystone.aspx',
      reservationRequired: false,
      note: 'First-come, first-served. Free at the River Run Gondola Lot, Mountain House East Lot, North Shuttle Lot (Hwy 6, free shuttle), and Lakeside Village Lot. The closer paid option, Mountain House West, runs $15 weekdays / $25 weekends and holidays.',
    },
    notes:
      'Vail Resorts’ 8/18/2026 release says Keystone is targeting "as soon as possible in October 2026" with no specific date, so no date is recorded despite the target being real. Trail-map URL not confirmed. Not fetch-verified.',
  },
  'crested-butte': {
    officialWebsite: 'https://www.skicb.com',
    snowReportUrl: 'https://www.skicb.com/the-mountain/mountain-conditions/lift-and-terrain-status.aspx',
    webcamUrl: 'https://www.skicb.com/the-mountain/mountain-conditions/mountain-cams.aspx',
    trailMapUrl: 'https://www.skicb.com/the-mountain/about-the-mountain/trail-maps.aspx',
    ticketUrl: 'https://www.skicb.com/plan-your-trip/lift-tickets.aspx',
    passInfoUrl: 'https://www.epicpass.com',
    phone: '970-251-7022',
    address: '12 Snowmass Rd, Crested Butte, CO 81225',
    openingDate: { date: '2026-11-25', status: 'projected' },
    closingDate: TBD_DATE,
    parking: {
      infoUrl: 'https://www.parkcrestedbutte.com/crestedbuttemountainresort',
      reservationRequired: false,
      note: 'Paid winter parking (~$15/day, $25 overnight) applies at the Main Lot Nov 23–Apr 7, 7am–3pm — pay by card at the station or the Tap \'N Ski app. Two free lots sit on Snowmass Rd and at Treasury/Gothic.',
    },
    notes:
      'Opening date per Vail Resorts’ 8/18/2026 press release (one secondary source suggested Nov 23 instead — the press release date is treated as authoritative). Not fetch-verified.',
  },
  'winter-park': {
    officialWebsite: 'https://www.winterparkresort.com',
    snowReportUrl: 'https://www.winterparkresort.com/the-mountain/mountain-report',
    webcamUrl: 'https://www.winterparkresort.com/the-mountain/mountain-cams',
    trailMapUrl: 'https://www.winterparkresort.com/the-mountain/mountain-information/maps',
    ticketUrl: 'https://www.winterparkresort.com/tickets-and-passes',
    passInfoUrl: 'https://www.ikonpass.com',
    phone: '970-726-5514',
    address: '85 Parsenn Rd, Winter Park, CO 80482',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    parking: {
      infoUrl: 'https://www.winterparkresort.com/plan-your-trip/getting-here/resort-parking',
      reservationRequired: false,
      note: 'About 3,200 free spaces at the base. North Bench Lot is free walk-in/walk-out; G-Lot, Old Town, Bus Barn, and Blue Spruce lots run free shuttles to the gondola. The Village Parking Garage and Vintage Lot are the paid, closer-in options.',
    },
    notes:
      'Resort’s own materials describe 2026-27 opening as "as soon as possible" with no fixed date — recorded as TBD rather than turning that into an invented date. Not fetch-verified.',
  },
  purgatory: {
    officialWebsite: 'https://www.purgatoryresort.com',
    snowReportUrl: 'https://www.purgatoryresort.com/mountain/mountain-report/',
    webcamUrl: null,
    trailMapUrl: null,
    ticketUrl: 'https://www.purgatoryresort.com/lift-tickets/',
    passInfoUrl: null,
    phone: null,
    address: '#1 Skier Place, Durango, CO 81301',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    parking: {
      infoUrl: null,
      reservationRequired: false,
      note: 'Free parking in the Main Village Lot and Overflow Lot. A free shuttle runs between the lots and the base 8am–5pm on operating days.',
    },
    notes:
      'FLAG FOR HUMAN REVIEW: current web search results for Purgatory resolve almost entirely to purgatory.ski rather than purgatoryresort.com (a possible rebrand/redirect). This could not be confirmed without working fetch access, so the previously-established purgatoryresort.com domain is kept here rather than switching on an unverified signal — a human with normal browser access should check which domain is now canonical. Webcam/trail-map/pass URLs, phone, and a parking infoUrl are left null for the same reason rather than guessed at the uncertain domain. No 2026-27 opening date found.',
  },
  copper: {
    officialWebsite: 'https://www.coppercolorado.com',
    snowReportUrl: 'https://www.coppercolorado.com/the-mountain/conditions-weather/snow-report/',
    webcamUrl: 'https://www.coppercolorado.com/the-mountain/webcams/',
    trailMapUrl: 'https://www.coppercolorado.com/the-mountain/trail-area-maps/winter-trail-map/',
    ticketUrl: 'https://www.coppercolorado.com/lift-tickets/',
    passInfoUrl: 'https://www.coppercolorado.com/tickets-passes/season-passes/ikon-pass/',
    phone: '866-841-2481',
    address: null,
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    parking: {
      infoUrl: 'https://www.visitcoppermountain.com/transportation',
      reservationRequired: false,
      note: 'Alpine and Far East lots are free for day parking (Alpine charges $20 for overnight, 10pm–5am). Other lots — Ten Mile, Chapel, Union Creek, Beeler, Wheeler — are paid, and most take advance reservations online; Triple Treat is pay-on-arrival only, if space remains.',
    },
    notes:
      'No 2026-27 opening date announced as of research. No officially confirmed street address surfaced (left null rather than guessed at the commonly-cited Copper Mountain, CO 80443). Not fetch-verified.',
  },
  'wolf-creek': {
    officialWebsite: 'https://wolfcreekski.com',
    snowReportUrl: 'https://wolfcreekski.com/mountain-report/',
    webcamUrl: 'https://wolfcreekski.com/webcams/',
    trailMapUrl: null,
    ticketUrl: 'https://wolfcreekski.com/lift-tickets/',
    passInfoUrl: null,
    phone: '970-264-5639',
    address: 'PO Box 2800, Pagosa Springs, CO 81147',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    parking: {
      infoUrl: 'https://wolfcreekski.com/parking-at-wolf-creek-ski-area-co/',
      reservationRequired: false,
      note: 'All parking and shuttles are free — Upper, Lower, Alberta, and Tranquility lots, plus a Snow Shed/Overflow lot on Hwy 160 that opens for holidays and busy periods (and is the option for overnight parking).',
    },
    notes:
      'Independent and famously snow-dependent — some seasons open in October on natural snowfall alone, but nothing published for 2026-27 yet. Address is the mailing address; the ski area itself has no separate street address. No confirmed trail-map URL or pass-program URL (own independent pass, same page as tickets). Not fetch-verified.',
  },
  'arapahoe-basin': {
    officialWebsite: 'https://www.arapahoebasin.com',
    snowReportUrl: 'https://www.arapahoebasin.com/mountain/conditions-and-weather/',
    webcamUrl: 'https://www.arapahoebasin.com/mountain-cams/',
    trailMapUrl: null,
    ticketUrl: 'https://www.arapahoebasin.com/tickets/',
    passInfoUrl: 'https://www.ikonpass.com/en/destinations/arapahoe-basin',
    phone: '888-272-7246',
    address: '28194 Highway 6, Dillon, CO 80435',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    parking: {
      infoUrl: 'https://www.parkabasin.com/parkingbasics',
      reservationRequired: null,
      note: 'Reservations ($20 most lots, $40 Admin Lot) are required Jan 17–May 3, weekends only, 6am–1pm; free and open after 1pm on weekends and anytime on weekdays. Free carpool parking (4+ people) in Easy Riser, High Noon, Last Chance, and Upper Last Chance.',
    },
    notes:
      'A-Basin’s own materials describe 2026-27 opening as explicitly TBD, pending sufficient snow. No confirmed trail-map URL. Not fetch-verified.',
  },
  loveland: {
    officialWebsite: 'https://www.skiloveland.com',
    snowReportUrl: 'https://www.skiloveland.com/conditions/',
    webcamUrl: 'https://skiloveland.com/webcams/',
    trailMapUrl: null,
    ticketUrl: 'https://www.skiloveland.com/lift-tickets/',
    passInfoUrl: 'https://skiloveland.com/season-passes/',
    phone: '800-736-3754',
    address: 'PO Box 899, Georgetown, CO 80444',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    parking: {
      infoUrl: 'https://skiloveland.com/plan-your-trip/faq/',
      reservationRequired: false,
      note: 'All parking is free at both the Loveland Valley and Loveland Basin lots — lots rarely fill even on busy weekends.',
    },
    notes:
      'Resort materials describe targeting "mid-October to early November 2026" with snowmaking starting late September — vague, so recorded as TBD rather than an invented specific date. Independent (Powder Alliance reciprocity, not Epic/Ikon). No confirmed trail-map URL. Not fetch-verified.',
  },
  eldora: {
    officialWebsite: 'https://www.eldora.com',
    snowReportUrl: 'https://www.eldora.com/the-mountain/mountain-report/',
    webcamUrl: 'https://www.eldora.com/the-mountain/webcams/',
    trailMapUrl: 'https://www.eldora.com/the-mountain/maps/alpine-trail-map/',
    ticketUrl: 'https://www.eldora.com/tickets-passes/lift-tickets/',
    passInfoUrl: 'https://www.eldora.com/ikon-pass/',
    phone: '303-440-8700',
    address: '2861 Eldora Ski Road #140, Nederland, CO 80466',
    openingDate: TBD_DATE,
    closingDate: TBD_DATE,
    parking: {
      infoUrl: null,
      reservationRequired: false,
      note: 'Single-occupancy vehicles pay $10 on weekends, holidays, and any weekday forecasting 10+ inches of snow; free the rest of the time, and always free with 2+ occupants. Vehicles with 3+ (HOV) park free in a premium lot near the Alpenglow lift.',
    },
    notes:
      'No official 2026-27 opening date found (a Nov 27, 2026 figure appears only on a third-party aggregator’s algorithmic projection, not an Eldora announcement, so not recorded). Not fetch-verified.',
  },
  steamboat: {
    officialWebsite: 'https://www.steamboat.com',
    snowReportUrl: 'https://www.steamboat.com/the-mountain/mountain-report',
    webcamUrl: 'https://www.steamboat.com/the-mountain/live-cams',
    trailMapUrl: 'https://www.steamboat.com/the-mountain/trail-map',
    ticketUrl: 'https://www.steamboat.com/lift-tickets',
    passInfoUrl: 'https://www.steamboat.com/plan-your-trip/lift-tickets-ski-pass/ikon-pass',
    phone: '800-922-2722',
    address: '2305 Mt. Werner Circle, Steamboat Springs, CO 80487',
    openingDate: { date: '2026-11-20', status: 'projected' },
    closingDate: TBD_DATE,
    parking: {
      infoUrl: 'https://www.steamboat.com/plan-your-trip/getting-here-and-around',
      reservationRequired: null,
      note: 'Meadows Lot is free Monday–Thursday; Upper Knoll is paid ($20–22/day) with prepay reservations via the ParkMobile app due by 10pm the night before. Both lots go free after 1pm, and for carpools of 3+ (Knoll still needs an advance carpool reservation).',
    },
    notes:
      'Nov 20, 2026 target is reported consistently by ski-trade outlets but could not be traced to a direct Alterra/Steamboat press release — a reputable secondary source, not a confirmed primary one, so treat with a little extra caution despite "projected" status. Not fetch-verified.',
  },
};

export const mountainProfileFor = (mountainId: string): MountainProfile | null =>
  MOUNTAIN_PROFILES[mountainId] ?? null;
