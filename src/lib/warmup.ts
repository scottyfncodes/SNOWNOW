/**
 * The traffic proxy (`server/index.mjs`) runs on a free hosting plan that
 * falls asleep after a few idle minutes and can take up to 30-50s to wake
 * back up on its next request. Firing a cheap, no-op ping at its health
 * endpoint as early as the app loads — before the user has even picked a
 * starting city — gives that wake-up a head start against the user's own
 * dwell time instead of racing the real traffic request's 15s timeout.
 *
 * Fire-and-forget by design: the result is never read, a failure here is
 * never surfaced, and nothing in the app waits on it. It either helps (the
 * server is warm by the time a real request goes out) or it does nothing.
 */
export function warmUpTrafficService(apiBaseUrl: string): void {
  if (!apiBaseUrl) return;

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
