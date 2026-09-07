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
npm run dev        # http://localhost:5173
npm test           # 175 tests
npm run build      # type-check + production bundle
npm run preview    # serve the built app
```

Node 20+ required. No API keys, no environment variables, no services.

---

## ⚠️ Demo data

**No live weather, traffic, lift, road or crowd feeds are connected.** Every
number the app shows today is produced by the demo provider bundle in
`src/providers/demo/`.

This is enforced structurally, not by convention:

- every value carries a `Provenance` stamp (`source`, `observation`, `confidence`)
- the UI renders a `DEMO DATA` badge wherever demo numbers appear
- the word `LIVE` is never shown for demo data — `DataBadge` refuses it
- when a feed is unavailable the app says so and declines to fill the gap
  ("Road intel is offline. We can show the mountain, but we're not going to
  fake the drive.")

The demo world is deterministic: the same date always produces the same
mountain day, so recommendations don't flicker and everything is testable.
Day 0 is deliberately shaped into a storm day — the product story starts at
4:47am with snow on the ground.

---

## Architecture

```
src/
  domain/       Types and pure primitives. No I/O, no React.
    time.ts       Minutes-since-local-midnight, the engine's unit of time
    dates.ts      DateKey helpers, weekday/holiday logic
    mountain.ts   The generic Mountain model
    conditions.ts Weather, operations, travel curves, crowds
    plan.ts       SnowClock, DayScore, DepartureOption, ReturnOption, SkiDayPlan
    provenance.ts Availability<T>, confidence, live-vs-demo

  config/       Everything tunable, in one place
    weights.ts    Scoring weights, rider preferences, optimiser economics

  data/         Content, not code
    mountains.ts  Epic Colorado + one Ikon mountain, access routes per origin
    origins.ts    Starting points
    corridors.ts  Shared traffic corridors and their severity

  providers/    Interfaces first, implementations behind them
    types.ts      WeatherProvider · TrafficProvider · MountainProvider
                  · PricingProvider · PlacesProvider
    demo/         The demo bundle (scenario, weather, traffic, mountain,
                  pricing, places)

  engine/       The product's actual intelligence. Pure, testable, no React.
    inputs.ts     Fan-out to providers; per-feed availability
    snowClock.ts  When is the mountain actually good?
    optimize.ts   Joint (leave home × leave mountain) optimisation
    scoring.ts    The number on the card, and why
    explain.ts    Plain-language reasoning
    plan.ts       buildPlan · recommend · stayOrGo
    future.ts     LATER: range projection with confidence discounting

  ui/           React. Renders plans; contains no business logic.
```

**The rule that shapes everything:** the UI never talks to a provider, and the
engine never talks to React. `App.tsx` is the only file that names a concrete
provider implementation — swapping the demo bundle for live integrations is a
one-line change there.

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
| Crested Butte | Deep enough to justify the drive | The drive |
| Purgatory | The San Juans get the storm | Being nowhere near Denver |

Over 60 simulated days from Denver the winner is spread across five mountains,
and it moves for reasons the explanation states out loud. Storm days go to the
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
npm test      # 138 tests, 11 files
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

## What would need real integrations

Everything below is behind a provider interface and needs credentials to go live:

| Interface | Needs |
|---|---|
| `WeatherProvider` | A mountain-grade forecast API (hourly snowfall, temperature, wind, density) |
| `TrafficProvider` | **Departure-time-dependent** routing (e.g. Google Routes with `departureTime`, or HERE) — a single current-ETA API is not enough, the whole product depends on the curve |
| `MountainProvider` | Lift/terrain status, grooming reports and snow reports; crowd signal (visitation, parking, lift-scan data) |
| `PricingProvider` | Resort commerce APIs or a ticket reseller — day rates by date and purchase lead time |
| `PlacesProvider` | A places API, for the après / wait-out-traffic layer |

Also not yet built, by design: accounts, saved mountains, notifications, service
worker (the manifest is in place but nothing is cached offline), webcams, chain
requirements, parking, multi-day trips, and pass ownership — SNOWNOW shows what
a day ticket costs but has no idea whether you already hold the pass.
