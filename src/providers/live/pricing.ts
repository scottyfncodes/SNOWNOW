import { resortSourceFor } from '@/data/resortSources';
import type { Mountain } from '@/domain/mountain';
import { type Availability, unavailable } from '@/domain/provenance';
import type { TicketPrice } from '@/domain/pricing';
import type { PricingProvider, ProviderContext } from '@/providers/types';

/**
 * Live-mode ticket pricing.
 *
 * Investigated, in priority order, for all fourteen resorts:
 *
 * 1. **Official resort ticket endpoint/API** — every resort's ticket price
 *    is behind its commerce platform's purchase flow (date picker, cart,
 *    session state), not a plain public "price for this date" endpoint.
 *    Vail Resorts and Alterra properties both compute price through
 *    JavaScript-driven checkout widgets, not a stable URL this provider
 *    could call.
 * 2. **Official structured ticket data published outside the purchase
 *    flow** — none of the fourteen resorts publish one. Dynamic pricing
 *    means the number on the page *is* the live system's internal state,
 *    which is exactly why it isn't exposed separately.
 * 3. **Official page with a reliably extractable current price** — this is
 *    the boundary the brief explicitly rules out: building a scraper for
 *    fourteen different commerce front-ends is the fragile, silently-
 *    breaking integration this project avoids everywhere else, and dynamic
 *    pricing means "reliably extractable" isn't true even in principle —
 *    the number changes with the querying session, not just the date.
 *
 * Monarch (added after the original thirteen-resort pass) was confirmed
 * to fit the same pattern rather than assumed: its own materials describe
 * prices that "fluctuate based on how busy the resort is expected to
 * be" — the same session-state dynamic pricing behind a purchase flow,
 * not a stable published rate.
 *
 * So: `unavailable`, honestly, for every resort — never the demo model's
 * plausible number presented as live. `SkiDayPlan.ticketPurchaseUrl` (set
 * from the same `resortSources.ts` registry `LiveMountainProvider` uses)
 * still points the user at the resort's real ticket page even though this
 * provider can't quote a price on it.
 */
export class LivePricingProvider implements PricingProvider {
  readonly id = 'live-pricing';

  async getTicketPrice(mountain: Mountain, _context: ProviderContext): Promise<Availability<TicketPrice>> {
    const source = resortSourceFor(mountain.id);
    const reason = source.officialPurchaseUrl
      ? `No verified live pricing feed for ${mountain.name} — dynamic pricing means the price is computed inside the purchase flow, not published separately. Buy at ${source.officialPurchaseUrl}.`
      : `No verified live pricing feed for ${mountain.name}.`;
    return unavailable(this.id, reason);
  }
}
