/**
 * Snow physics shared between the demo world and any real forecast.
 *
 * Extracted so the demo generator and a live provider agree on what "density"
 * means instead of each inventing their own curve — the same warm, heavy snow
 * at 33°F should read the same way regardless of which provider reported it.
 */

/**
 * Snow-water-equivalent ratio, estimated from air temperature.
 *
 * ~0.06 is blower Rocky Mountain powder around 10°F; ~0.12 is heavy,
 * Sierra-cement-style snow near freezing. This is a coarse proxy — real SWE
 * depends on the storm's moisture source too — but it is the same coarse
 * proxy everywhere in the app, which is the point.
 */
export function estimateSnowDensity(temperatureF: number): number {
  const raw = 0.045 + (temperatureF - 5) * 0.0022;
  return Math.min(0.13, Math.max(0.04, raw));
}
