# SNOWNOW

**Find your best mountain day.**

SNOWNOW is a decision engine for ski days. Not a snow report, not a traffic app,
not another conditions dashboard — an app that answers one question:

> What is the best mountain day I can realistically have?

It optimises the whole loop — **HOME → MOUNTAIN → SNOW → MOUNTAIN → HOME** —
for maximum good skiing and minimum miserable driving, and gives you the call:

```
BRECK
9.2
LET'S RIDE.

Leave 5:18 AM · Arrive 7:04 AM
Prime snow 8:10–10:47 AM
Head home 2:42 PM · Home 4:28 PM
```

---

## The two modes

| | Means | Answers |
|---|---|---|
| **NOW** | Decision mode. Today. | "I want to ski today — where, and when do I leave?" |
| **LATER** | Planning mode. A future date or range. | "What would my ski day look like on Saturday?" |

Both ask the same question and share the same engine. LATER differs only in how
much certainty it is willing to claim.

---

## Running it

```bash
npm install
npm run dev        # http://localhost:5173 — demo mode, zero setup
npm test           # 289 tests
npm run build      # type-check + production bundle
npm run preview    # serve the built app
npm run server     # the traffic proxy (server/index.mjs) — only needed for live traffic
```

Node 20+ required. **With no environment variables set, the app runs entirely
in demo mode** — no API keys, no services, no network calls beyond loading the
page. See "Going live" below for what each optional variable turns on.

---

## ⚠️ Data honesty

SNOWNOW can run on demo data, a mix of live and demo, or (mostly) live data —
and it is always honest about which. This is enforced structurally, not by
convention:

- every value carries a `Provenance` stamp (`source`, `observation`,
  `confidence`, and for live data `fetchedAt`/`validUntil`)
- the UI resolves that into exactly one of four words — **LIVE**, **STALE**,
  **DEMO DATA**, **UNAVAILABLE** — via `domain/provenance.ts#displayStatus`,
  and never shows a fifth
- a live value past its own freshness window reads **STALE**, not LIVE
- demo data is never upgraded to LIVE, no matter how fresh it "feels"
- when a feed is unavailable the app says so and declines to fill the gap
  ("Road intel is offline. We can show the mountain, but we're not going to
  fake the drive.")
- a live registry never falls back to demo data, at any point — not per
  request, and not even as a configuration default when something's unset.
  A slot with nothing genuinely live to serve reports `unavailable`,
  mechanically enforced (`providers/index.test.ts`) — see "The production
  data gate" below
- tap "Where this data came from" on any recommendation to see every feed's
  status, provider and fetch time individually — the one aggregate badge on
  the card is a summary, not the only source of truth

The demo world is deterministic: the same date always produces the same
mountain day, so recommendations don't flicker and everything is testable.
Day 0 is deliberately shaped into a storm day — the product story starts at
4:47am with snow on the ground.

### Going live

| Provider | Status | What it needs |
|---|---|---|
| **Weather** | Live | Nothing — Open-Meteo is free, keyless, CORS-enabled |
| **Alerts** (NWS) | Live | Nothing — same deal, US mountains only |
| **Traffic** | Live | `server/` deployed + `GOOGLE_ROUTES_API_KEY` + `VITE_API_BASE_URL`, else **unavailable** |
| **Road closures** (CDOT/COtrip) | Live, unverified, on by default | `VITE_ENABLE_ROAD_CONDITIONS=false` to disable → **unavailable** |
| **Lift ops, terrain** | Live where covered, else unavailable | Nothing — tries Liftie (third-party) automatically |
| **Crowds** | Unavailable, always | No trustworthy live source exists — retired, see below |
| **Pricing** | Unavailable, always | Investigated, unverifiable — official purchase link shown instead |
| **Places** | Unavailable, always | No live implementation exists for this pass |

```bash
cp .env.example .env
# edit .env — at minimum: VITE_DATA_MODE=live
npm run build
```

`VITE_*` variables are baked into the client bundle **at build time**, not
read at runtime — switching modes means rebuilding, which is also what keeps
demo mode the safe, can't-happen-by-accident default: there is no runtime
toggle to flip on live data without a deliberate build.

Full traffic integration needs `server/index.mjs` running somewhere with
`GOOGLE_ROUTES_API_KEY` set (Render, Fly, a small VPS, anywhere Node runs —
GitHub Pages cannot host it, since Pages serves static files only and has no
way to hold a server-side secret). Every variable is documented in
`.env.example`.

### GPS-based routing

"📍 Use my current location" sends the browser's exact `navigator.geolocation`
coordinates to the same `/api/travel-curve` endpoint the six manual cities
already use — `origin`/`destination` there were always plain `{ lat, lon }`,
never a place name or an address, so **no new Google API and no geocoding
service were added**. The Google Routes `computeRoutes` call this project
already makes accepts an arbitrary coordinate as `origin.location.latLng` the
same way it accepts one of the six cities'; that capability was already
present in the existing `GOOGLE_ROUTES_API_KEY`; this feature only stopped
throwing the GPS fix away before it reached that call
(`ui/components/OriginPicker.tsx` used to look up the *nearest of the six
cities* and route from there instead — see `engine/routing.ts` for the
replacement). Geocoding (reverse or forward) was deliberately not added: the
UI never needs to show a street address, only "Using your current location".

One real cost implication: the server's travel-curve cache key is rounded to
three decimal degrees (~300 ft) and shared across every visitor asking about
the same (origin, destination, direction, date). Six fixed cities pool every
visitor from that city onto the same cache entries; a GPS fix is different
for nearly every visitor, so GPS requests mostly miss that shared cache and
each pay their own Google Routes calls. This is an inherent cost of routing
from someone's actual location rather than a bug — see "Caching and API
cost" below for the numbers.

### The production data gate

`createLiveRegistry()` (`providers/live/index.ts`) never returns a
`Demo*Provider` in any slot, under any configuration. This isn't a claim —
it's mechanically enforced: `providers/index.test.ts` constructs a live
registry with every optional knob left unset and asserts none of its seven
provider slots is `instanceof` any of the seven demo classes, then repeats
the check with each knob individually disabled. A slot this registry can't
genuinely serve reports `unavailable` (see `providers/live/unavailable.ts`)
— never the plausible-looking demo number that same slot would show in an
actual demo build.

One caveat, stated precisely rather than glossed over: this is a **runtime**
guarantee, not a **bundle-size** one. `providers/index.ts` still statically
imports both `createDemoRegistry` and `createLiveRegistry` so the same
function can dispatch between them from one build — Rollup/esbuild cannot
prove `env.dataMode` is always `'live'` across that function-call boundary,
so the demo providers' code (including the demo scenario generator) remains
present as inert bytes in the production JS bundle, just never constructed.
Actually removing those bytes would mean loading the demo registry via a
dynamic `import()` behind a loading state — a real change to how the app
boots, which risks exactly the "don't redesign the UX" line this project
holds elsewhere, for a benefit that's cosmetic (bundle KB) rather than
about correctness (what data reaches the user). Not done, on purpose,
documented rather than left implicit.

### Mountain operations: a three-tier strategy

`LiveMountainProvider.getOperations` (`providers/live/mountainStatus.ts`)
tries, in order:

1. **Official resort feed.** Not implemented. It would need a verified,
   structured (JSON/REST/GraphQL) endpoint per resort, confirmed by actually
   hitting it — and this sandbox has no network path to any resort's site to
   find and confirm one for even a single mountain, let alone the thirteen
   in the dataset. Guessing at undocumented endpoints across a dozen
   different commerce/CMS platforms without verification is exactly the
   fragile, unaccountable integration this project avoids everywhere else.
2. **Liftie** (`providers/live/liftieOperations.ts`), a real, established
   third-party lift-status aggregator with a documented REST API
   (`GET https://liftie.info/api/resort/:id`) and existing Colorado
   coverage. `data/resortSources.ts` is the registry of which mountains are
   believed to have Liftie coverage; a resort with no entry there goes
   straight to Tier 3 rather than guessing a slug. Every value sourced this
   way carries `Provenance.attribution` saying plainly "Third-party
   aggregator (Liftie) — not the resort's own feed" — the UI renders this
   next to the provider name so a Liftie-sourced lift count can never read
   as official.
3. **Unavailable.** No real signal, no invented one. The engine already has
   a correct, tested answer for this: `scoring.ts` and `snowClock.ts` impute
   a neutral value and flag it as imputed, which lowers the plan's
   confidence rather than quietly scoring a made-up number (see
   `engine/scenarios.test.ts`, scenarios 11 and 12, for both halves of this
   — a real closure marks the score down for real, and a missing feed
   doesn't get treated as either "everything's open" or "everything's
   closed").

⚠️ Same caveat as CDOT below: this sandbox's network policy blocks
`liftie.info` outbound, so the Tier-2 response shape is implemented against
Liftie's documented API, not confirmed against a live answer. It fails safe
either way — an unrecognized shape returns `unavailable`, never a guessed
lift count (see `liftieOperations.test.ts`).

### Ticket pricing: investigated, and genuinely unavailable

`LivePricingProvider` (`providers/live/pricing.ts`) is the result of
actually checking, resort by resort: every one of the thirteen mountains
prices tickets through a dynamic commerce platform (a date-picker → cart →
checkout flow), not a stable, public "price for this date" endpoint. None
publishes structured pricing data outside that flow. Building a scraper
across thirteen different front-ends to extract a number that changes with
the querying session — not just the date — is precisely the fragile,
silently-breaking integration ruled out elsewhere in this project, and
"reliably extractable" isn't achievable even in principle when the number
is stateful.

So live mode reports ticket price as `unavailable` for every resort,
honestly — never the demo model's plausible number presented as live. The
resort's real ticket page is still shown (`SkiDayPlan.ticketPurchaseUrl`,
from the same `data/resortSources.ts` registry), so "we can't confirm the
price" never means "and we won't tell you where to look." `PricingProvider`
stays a real interface with a real production path (a ticketing platform's
partner API) if one becomes available later.

### Places: never in scope

`PlacesProvider` (après suggestions) has no live implementation and wasn't
investigated in this pass. In live mode it reports `unavailable` — never
demo data (see "The production data gate" above).

### Crowds: retired from live mode

`LiveMountainProvider.getCrowdForecast` used to run a calendar heuristic
here (weekday/weekend, holiday, mountain popularity), honestly labeled
`low` confidence and `projected` — real arithmetic on real calendar facts,
not a simulation. It has been removed. The reasoning: it was still a
projection standing in for an observed signal, and a production decision
engine is more trustworthy with fewer real signals than with one that can
be mistaken for measured attendance. It now reports `unavailable`
unconditionally.

This is not a gap that silently weakens the recommendation: `crowds` is a
lightly-weighted (`0.6` in `config/weights.ts`), optional scoring factor,
and `scoring.ts` already imputes a neutral contribution and flags it as
imputed whenever it's unavailable — the exact, already-tested mechanism
every other unresolved live signal uses (see `engine/scenarios.test.ts`).
Nothing about a plan's timing, snow read, or operations read depends on
crowd data. If a trustworthy live occupancy/crowd source is identified
later, `MountainProvider.getCrowdForecast` is still a real interface a live
implementation can drop into.

---

## Architecture

```
src/
  domain/       Types and pure primitives. No I/O, no React.
    time.ts       Minutes-since-local-midnight, the engine's unit of time
    dates.ts      DateKey helpers, weekday/holiday logic
    mountain.ts   The generic Mountain model (routes carry their own lat/lon)
    conditions.ts Weather, operations, travel curves, crowds
    alerts.ts     Official weather alerts — supplements the forecast only
    road.ts       Authoritative road/corridor status, separate from traffic
    plan.ts       SnowClock, DayScore, DepartureOption, ReturnOption, SkiDayPlan
    provenance.ts Availability<T>, confidence, displayStatus (LIVE/STALE/DEMO/UNAVAILABLE)

  config/       Everything tunable, in one place
    weights.ts    Scoring weights, rider preferences, optimiser economics
    env.ts        The one place that reads import.meta.env

  lib/          Small, dependency-free utilities shared across providers
    cache.ts      TTL cache + memoizeAsync (in-flight de-duplication)
    http.ts       fetchJson with a hard timeout and typed failures
    snow.ts       Snow-density physics shared by demo and live weather

  data/         Content, not code
    mountains.ts  Thirteen Colorado mountains, four pass networks, two snow
                  regions; access routes per origin
    origins.ts    The six manually-selectable starting cities, plus
                  `gpsOrigin()` for a live GPS fix
    corridors.ts  Shared traffic corridors, their severity and weather region
    pricing.ts    Demo lift-ticket rate cards
    resortSources.ts  Per-resort live-data registry: Liftie slug, official
                  ops page, official ticket page — where live providers look

  providers/    Interfaces first, implementations behind them
    types.ts      WeatherProvider · TrafficProvider · MountainProvider ·
                  PricingProvider · PlacesProvider · AlertsProvider ·
                  RoadConditionProvider
    demo/         The demo bundle — deterministic, used by every engine test
    live/         Production adapters: Open-Meteo, NWS, Google Routes (via
                  server/), CDOT/COtrip (best-effort, see its file docblock),
                  Liftie (mountain operations, third-party, best-effort),
                  LivePricingProvider (always unavailable — see docblock)
    index.ts      createProviderRegistry() — the one place mode is decided

  engine/       The product's actual intelligence. Pure, testable, no React.
    inputs.ts     Fan-out to providers; per-feed availability; enforces that
                  a closed corridor removes a route, not just its score
    routing.ts    resolveAccessRoutes() — the origin abstraction. A manual
                  city gets its hand-authored routes; any other origin (a
                  GPS fix, above all) gets one route synthesized straight
                  from its own coordinates, never snapped to a city
    snowClock.ts  When is the mountain actually good?
    optimize.ts   Joint (leave home × leave mountain) optimisation
    scoring.ts    The number on the card, and why
    explain.ts    Plain-language reasoning
    plan.ts       buildPlan · recommend · stayOrGo
    future.ts     LATER: range projection with confidence discounting

  ui/           React. Renders plans; contains no business logic.
```

**The rule that shapes everything:** the UI never talks to a provider, and the
engine never talks to React. `App.tsx` calls exactly one function —
`createProviderRegistry()` — and that function, plus `resolveEnvironment()`
right beside it, are the only two places in the entire codebase that decide
demo vs. live. Every other file, including every engine test, talks to
`ProviderRegistry` and has no idea which world it's in.

### The Snow Clock

Ski quality is modelled through the day at 15-minute resolution. Fresh snow is
treated as a **consumable stock**, not a static number: it accumulates
overnight, grows while it snows, and is consumed at a rate driven by how many
people are on the hill and how much terrain is open to spread them over.
Everything else — surface temperature, sun, wind, visibility, lift access,
avalanche-control delays — modulates how good the remaining snow is to ski.

"Prime" is the best contiguous stretch relative to the day's own peak, so a day
that never drops below 80 still has a prime window, and a mediocre day still
gets a named best-stretch rather than nothing.

### The optimiser

Morning and afternoon are **not** independent problems. Leaving later can be
worth it if it buys a better exit; skiing longer is only worth it if the drive
home doesn't eat the gain. So `optimizeDay` searches a grid of *(leave home,
leave mountain)* pairs jointly — typically several thousand candidate days per
mountain — and scores each in one currency: **quality-weighted ski minutes**.

One minute of 100-quality skiing is worth 1.0. One minute of 60-quality skiing
is worth 0.6. Drive time, congestion pain, sleep, standing in a dark car park
before the ropes drop, après while the road empties, and a late arrival home
are all converted into that same currency by `OPTIMIZER_CONFIG` — not by magic
numbers sprinkled through the code.

Selection is two-stage: the utility function narrows the field, and the
**published score makes the final call**, so the app can never recommend 4:54am
while displaying a better number next to 5:30am.

### Scoring

Eleven weighted factors — snow, snow timing, weather, wind, terrain,
operations, travel burden, traffic, roads, crowds, useful ski time — plus named
post-hoc penalties for costs that have no upper bound (getting home hours late).

Traffic and crowds are weighted *lightly* on purpose: both already depress the
snow clock and the travel burden, and double-counting them would let a
two-hour dawn patrol outscore a full powder day.

A missing feed produces a neutral, **explicitly flagged** value and lowers the
day's confidence. It never silently becomes a plausible-looking number.

The score is decision support. It is not a measurement of anything.

### Lift ticket pricing

Price lives in three places and no others: the rate cards in
`src/data/pricing.ts`, the `PricingProvider` interface, and one weighted factor
in the scoring layer. No component imports a price from anywhere but the plan
it was handed, so a live pricing feed replaces the demo source without touching
the UI or the optimiser.

Demo prices are shaped like the real market — a walk-up window rate against a
much lower advance rate, flexed by demand, weekend, holiday and how much snow
just fell — and they carry the same provenance stamp as everything else. There
is no such thing as a "LIVE" price in this build.

**How much it counts.** Ticket price is decision context, not the decision. It
is weighted (`config/weights.ts`) so the entire spread of the market — roughly
$200 between the cheapest independent and a peak window rate — moves the
published score by less than 0.8 out of 10. That is enough to break a genuine
tie and enough to be visible in the explanation, and deliberately nowhere near
enough for a cheap ticket to outrank a materially better ski day.
`scoring.test.ts` holds that line with an explicit test, so raising the weight
breaks the build rather than quietly turning SNOWNOW into a bargain finder.

### Adding a mountain

Add an entry to `src/data/mountains.ts` with its access routes. Nothing in the
engine, the scoring, the optimiser or the UI knows any mountain's name — Epic
is simply the first dataset loaded, and `passAffiliations` is a data field.
Adding Ikon, Mountain Collective, Indy, an independent, or another country is
a data change.

`dataset.test.ts` proves it: it plans a wholly invented mountain that has no
demo profile, no pricing entry and no code path of its own, and gets a
complete, scored, explained ski day back.

### Why the winner changes

The demo data is tuned for *causal* differentiation, not variety for its own
sake. Each mountain has an identity and a condition that punishes it, and the
weather generator produces the conditions that expose them:

| Mountain | Wins when | Loses when |
|---|---|---|
| Vail | It dumps and the wind stays down | Wind, crowds, the drive |
| Beaver Creek | It's blowing everywhere else | Modest snow, furthest up I-70 |
| Breckenridge | Cold, calm, decent snow | Wind holds, long control work |
| Keystone | Dry and firm — first chair, best corduroy | Any real storm |
| Winter Park | Real snow and clear roads | Berthoud Pass in a storm |
| Copper | Closest big mountain to Denver, terrain that sorts itself | The top goes on wind hold |
| Crested Butte | Deep enough to justify the drive | The drive |
| Purgatory | The San Juans get the storm | Being nowhere near Denver |
| Wolf Creek | It's deep, and the ticket is $99 | Four and a half hours from Denver |

Over 60 simulated days from Denver the winner is spread across seven
mountains, and it moves for reasons the explanation states out loud. Storm days go to the
powder mountains, wind events go to the sheltered ones, dry days go to whoever
grooms hardest and is closest.

Two modelling details do most of that work. Wind **exposure** multiplies the
excess over a calm baseline rather than the whole number, so an exposed alpine
mountain is not windier than its neighbour on a still morning — only when the
wind actually blows. And the two snow regions (`i70-corridor`, `san-juans`)
share a synoptic regime but roll their own outcome, so a system can favour one
end of the state while the other gets scraps.

---

## Tests

```
npm test      # 289 tests, 24 files
```

The core optimisation logic is tested without rendering any UI, against
hand-built fixtures (`src/test/fixtures.ts`) rather than the demo providers — a
test that fails because the demo weather changed would be telling us nothing.

Coverage spans: snow-clock physics (track-out rate, terrain spread, grooming,
wind, control delays, late openings), prime-window selection, scoring (factor
interactions, weight configuration, imputation, extremes, penalties, the
ticket-price ceiling), morning departure optimisation (rush-hour curves, prime
capture, drive ceilings, preference response), return optimisation (afternoon
walls, stay-vs-go, waiting past last chair), the recommendation layer (ranking,
explanation, determinism, "more snow ≠ better day"), LATER (confidence decay,
best-bet discounting), dataset integrity, planning a mountain the engine has
never seen, demo-provider determinism, regional storm tracks and pricing,
provider-failure handling, and the UI end-to-end — including the ten-second
test as an executable acceptance test, honest empty states, and accessibility.

**Live-data-specific coverage** (all against mocked `fetch`, since this
sandbox's network policy blocks the real endpoints — see "Known limitations"):
Open-Meteo response normalization, unit conversion, malformed/incomplete
payloads, the 16-day forecast ceiling, timeouts and network failures; NWS
alert parsing, non-US scope, malformed features; the Google Routes client's
request shape (proves no API key or Google URL ever appears in what the
browser sends), response normalization, and every failure mode; the CDOT
adapter's fail-safe behaviour on an unconfirmed schema; the TTL cache
(expiry, in-flight de-duplication); `displayStatus` (LIVE/STALE/DEMO/
UNAVAILABLE) including the stale-past-`validUntil` case; a corridor closure
that removes a route from consideration entirely rather than scoring it down,
including the case where the whole mountain becomes unreachable; and mixed
live+demo inputs flowing through the pipeline without special-casing.

**The scenario suite** (`engine/scenarios.test.ts`) is the one explicitly
asked for beyond code coverage: ten realistic Colorado ski days — a huge
overnight storm at Wolf Creek, light snow at Copper, a wind event a sheltered
mountain wins, heavy I-70 traffic, an I-70 closure, a great morning ruined by
afternoon traffic, poor new snow saved by grooming, and missing traffic,
missing weather, and stale data — each asserting not just a number but that
the plan's own explanation (`headline`, `reasons`, `caveats`) states the real
reason a knowledgeable Colorado skier would recognise.

---

## Design

Dark by commitment, not by toggle. The app is designed for one specific moment:
a phone held in one hand, in a dark room, at 4:47 in the morning, by someone who
has not had coffee yet. That rules out light backgrounds, small type, dense
tables and anything that needs to be studied.

- mobile-first, one-handed, 44px+ tap targets, minimal typing
- huge numerals, strong hierarchy, generous space
- motion is decoration and switches itself off for `prefers-reduced-motion`
- charts are hand-rolled SVG (no charting library) and expose their data as
  tables to assistive technology
- status is never encoded in colour alone — the trade-off chips carry a sign,
  the traffic states carry a glyph and a word
- ~90 kB gzipped, no web fonts, no external requests

**Measured, not assumed.** Every text style was checked against the surface it
actually renders on: no text on any screen falls below WCAG AA (4.5:1 for body,
3:1 for large). There is no horizontal overflow at 320, 390, 430, 834 or
1280px, and nothing that is meant to be tapped is under 44px tall. Wide content
— the hour strip, the stay-or-go table — scrolls inside its own container
rather than the page.

**The verdict outranks the decimal.** The score is calibrated against what the
model actually produces rather than a tidy-looking ruler: a real ski day pays a
permanent tax (the drive is never free, the ticket is never cheap, a big storm
brings snow-packed roads with it), so honest factors average into the 6s and
7s. "LET'S RIDE." is pinned to a number the model reaches a couple of times a
season, which is the point of having it.

---

## Caching and API cost

The optimiser was already built to ask a provider for one whole travel curve
per (route, direction) and interpolate locally (`engine/travel.ts#travelAt`) —
it never asks again per candidate departure time. Going live only had to
preserve that contract, not invent it.

- **Client-side**: `React` re-renders don't re-fetch — `loadDayInputs` is
  called once per (mountain, date) and its result flows through props.
- **Server-side** (`server/index.mjs`): every (corridor, direction, date)
  travel curve is cached for `TRAFFIC_CACHE_TTL_SECONDS` (default 15 min) and
  **shared across every visitor**, not per-session. The first person to ask
  about Breck today pays the Google Routes calls; everyone else in the next 15
  minutes gets the cached curve.
- **Open-Meteo and NWS** need no server-side cache to be cheap — both are
  free, keyless, rate-generous public APIs — but a production deployment
  fielding real traffic should still put a short (~5 min) cache in front of
  them rather than one call per page load, which this build does not yet do
  (see "Known limitations").

**API calls for one NOW request** (one mountain, one origin, cache cold):

| Call | Count | Notes |
|---|---|---|
| Open-Meteo forecast | 1 | One HTTP request, all hourly fields |
| NWS alerts | 1 | One HTTP request |
| Google Routes (server) | up to 20 | 9 outbound + 11 return departure-time samples — see `server/index.mjs`'s `OUTBOUND_MINUTES`/`RETURN_MINUTES` |
| CDOT (if enabled) | 1 per unique corridor | Unverified integration, off by default |

A full NOW screen (the recommendation plus every reachable alternative — 5-8
mountains from Denver) multiplies the Google Routes count by the number of
mountains on a cold cache, since each mountain's route is a different
corridor. **Estimated cost at low personal-use volume:** Open-Meteo and NWS
are free with no meaningful limit at this scale. Google Routes' `computeRoutes`
is billed per call past its free tier; at roughly 20 calls per cold-cache
mountain and a 15-minute shared cache, a single person checking SNOWNOW a
handful of times a day sits comfortably inside typical free-tier allowances —
the cache is what keeps a small friend group well within it too, since they'd
mostly be hitting warm cache. This has not been measured against a real
Google Cloud billing account; treat it as an informed estimate, not a quote.

**GPS mode changes this math.** The table above assumes an origin the cache
can pool across visitors — true for the six manual cities, not true for a
GPS fix, which lands on a different cache key for nearly every user. A GPS
NOW request should be estimated as a fully cold cache every time: up to 20
Google Routes calls per mountain, times every reachable mountain (now all
thirteen, not just the ones with a manual route from the chosen city), per
direction. This is a real, expected increase in Google Routes call volume
versus city-only routing — not a defect — and is the direct cost of routing
from someone's actual location. At low personal-use volume it should still
sit inside Google's free tier; a public multi-user deployment should budget
for it explicitly rather than assuming the six-city cache-sharing math still
applies.

## Live data matrix

| Mountain | Operations source | Live? | Pricing source | Live? |
|---|---|---|---|---|
| Vail | Liftie (`vail`) | Attempted*, else unavailable | — | Unavailable — [buy](https://www.vail.com/plan-your-trip/lift-tickets.aspx) |
| Beaver Creek | Liftie (`beavercreek`) | Attempted*, else unavailable | — | Unavailable — [buy](https://www.beavercreek.com/plan-your-trip/lift-tickets.aspx) |
| Breckenridge | Liftie (`breckenridge`) | Attempted*, else unavailable | — | Unavailable — [buy](https://www.breckenridge.com/plan-your-trip/lift-tickets.aspx) |
| Keystone | Liftie (`keystone`) | Attempted*, else unavailable | — | Unavailable — [buy](https://www.keystoneresort.com/plan-your-trip/lift-tickets.aspx) |
| Crested Butte | Liftie (`crested-butte`) | Attempted*, else unavailable | — | Unavailable — [buy](https://www.skicb.com/plan-your-trip/lift-tickets.aspx) |
| Winter Park | Liftie (`winter-park`) | Attempted*, else unavailable | — | Unavailable — [buy](https://www.winterparkresort.com/tickets-and-passes) |
| Copper | Liftie (`copper`) | Attempted*, else unavailable | — | Unavailable — [buy](https://www.coppercolorado.com/lift-tickets) |
| Arapahoe Basin | Liftie (`arapahoe-basin`) | Attempted*, else unavailable | — | Unavailable — [buy](https://www.arapahoebasin.com/tickets/) |
| Loveland | Liftie (`loveland`) | Attempted*, else unavailable | — | Unavailable — [buy](https://www.skiloveland.com/lift-tickets/) |
| Eldora | Liftie (`eldora`) | Attempted*, else unavailable | — | Unavailable — [buy](https://www.eldora.com/tickets-passes/lift-tickets/) |
| Steamboat | Liftie (`steamboat`) | Attempted*, else unavailable | — | Unavailable — [buy](https://www.steamboat.com/lift-tickets) |
| Purgatory | None (no confirmed Liftie coverage) | Unavailable | — | Unavailable — [buy](https://www.purgatoryresort.com/lift-tickets/) |
| Wolf Creek | None (no confirmed Liftie coverage) | Unavailable | — | Unavailable — [buy](https://wolfcreekski.com/lift-tickets/) |

\* "Attempted" means `LiveMountainProvider` calls Liftie for that resort and
normalizes a successful response; whether it actually returns live data
right now depends on Liftie's own current coverage and uptime, which this
sandbox cannot check (see below) — a miss fails safe to `unavailable`, never
a fabricated lift count. **Pricing is `unavailable` for all thirteen by
design**, not by gap — see "Ticket pricing: investigated, and genuinely
unavailable" above.

## Known limitations

- **Google Routes traffic is live, deployed, and smoke-tested against a real
  key** — `server/index.mjs` is running on Render with a real
  `GOOGLE_ROUTES_API_KEY`, and a real request returned real Denver→Copper
  Mountain drive times (101–104 minutes across the sampled departure grid,
  congestion varying realistically by time of day). The GitHub Pages build
  is configured for live mode (`VITE_DATA_MODE=live`) and points at that
  deployment.
- **Open-Meteo, NWS, CDOT, and Liftie have not been smoke-tested against
  their real endpoints from this environment.** This sandbox's network
  policy blocks `api.open-meteo.com`, `api.weather.gov`,
  `manage-api.cotrip.org`, and `liftie.info` outbound — confirmed multiple
  times via both a direct `curl` and a `WebFetch` attempt, both returning a
  connection-level rejection from the egress proxy itself, not an API-level
  error. All four are implemented with realistic mocked responses and
  passing tests only; none has actually round-tripped a real answer from
  its real endpoint from inside this environment. Open-Meteo and NWS are
  widely-used, well-documented public APIs, so that gap is lower-risk than
  it would be for an undocumented one. CDOT and Liftie are real, named,
  official/established sources — `manage-api.cotrip.org` is the endpoint
  the Colorado Information Marketplace documents for the COtrip real-time
  feed, and `liftie.info/api/resort/:id` is Liftie's documented API — but
  their exact field names are still unconfirmed, which is why both
  `cotripRoad.ts` and `liftieOperations.ts` are written defensively enough
  that an unrecognized shape fails safe (`unavailable`) rather than
  fabricating a closure, a chain-law advisory, or a lift count. Before
  trusting either in production: hit the endpoint once by hand (see the
  "Verifying this" note in `cotripRoad.ts`) and confirm the response shape
  matches what the normalizer expects.
- **CDOT/COtrip and Liftie integrations are verified-shape scaffolds, not
  confirmed integrations.** Both fail safe by construction (`unavailable`,
  never a fabricated result) if the real schema differs from what's
  implemented, but "fails safe" is not the same claim as "works." Road
  conditions stay off by default (`VITE_ENABLE_ROAD_CONDITIONS=false`);
  mountain operations is on by default since a per-resort miss is cheap and
  self-contained (one mountain's card says UNAVAILABLE, nothing else is
  affected).
- **No shared cache for weather/alerts/operations.** Fine at personal-use
  volume; a multi-user production deployment should add one rather than
  calling these once per page load per visitor.
- **The in-memory server cache doesn't survive a restart or scale past one
  instance.** A real multi-instance deployment needs Redis or a KV store
  behind the same `cacheGet`/`cacheSet` shape.
- **Colorado/`America/Denver` only.** The server's local→UTC departure-time
  conversion is correct and DST-aware (tested), but a mountain outside that
  time zone needs the zone threaded through, not hard-coded.
- **Google Routes' response schema has been confirmed against one real live
  response** (the Denver→Copper smoke test above), not exhaustively —
  `routes.duration` parsing has a single defensive fallback path (returns
  `null`, the point gets skipped) rather than exhaustive shape validation.
- **Ticket pricing is unavailable for every resort, on purpose** — see
  "Ticket pricing: investigated, and genuinely unavailable" above. This is
  the one gap that isn't a "not yet verified" caveat: it's the documented
  conclusion of actually checking, not a placeholder for future work.
- **Liftie coverage for Purgatory and Wolf Creek is unconfirmed**, so
  `data/resortSources.ts` leaves their `liftieSlug` unset rather than
  guessing one — both report `unavailable` for operations until a real
  slug is confirmed and added to the registry.

## What's intentionally still demo, and what's not built at all

**Nothing is demo in live mode, of anything.** Places (après suggestions)
has no live implementation; crowds has been retired; pricing was
investigated and found unverifiable — all three report `unavailable`, not
demo data, in a live registry (see "The production data gate" above).
`Demo*Provider` classes exist only for `createDemoRegistry()`, used by
`npm run dev` with no env vars set and by every deterministic engine test —
never reachable from a live-mode registry, which `providers/index.test.ts`
enforces directly.

Not yet built, by design and unrelated to this pass: accounts, saved
mountains, notifications, a service worker (the manifest is in place but
nothing is cached offline), webcams, chain requirements, parking, multi-day
trips, and pass ownership — SNOWNOW shows what a day ticket costs but has no
idea whether you already hold the pass.
