/**
 * In production this pings this same deployment's own `/api/health`
 * serverless function (see `api/health.mjs`) — Vercel functions don't have
 * the "asleep after 15 idle minutes" problem a long-running Render process
 * had, so this is now a minor optimization (nudging a fresh instance warm a
 * little earlier) rather than the critical head-start it used to be against
 * a 30-50s cold boot. Kept for local dev too, where `apiBaseUrl` can point
 * at an external `npm run server` process that behaves like any other
 * always-on local process — no sleep/wake behavior either, but still a real
 * network round trip worth starting early.
 *
 * Fire-and-forget by design: the result is never read, a failure here is
 * never surfaced, and nothing in the app waits on it. It either helps (the
 * function/server is warm by the time a real request goes out) or it does
 * nothing.
 */
export function warmUpTrafficService(apiBaseUrl: string | null): void {
  // `null` means no traffic backend is configured at all; `''` (same-origin)
  // and a real absolute URL both mean there's something to ping. See
  // `config/env.ts#SnownowEnvironment.trafficApiBaseUrl`.
  if (apiBaseUrl == null) return;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  fetch(`${apiBaseUrl}/api/health`, { signal: controller.signal })
    .catch(() => {
      // Best-effort only — a cold start, a network hiccup, or the service
      // being genuinely down all look the same from here, and none of them
      // are this function's job to report.
    })
    .finally(() => clearTimeout(timer));
}
