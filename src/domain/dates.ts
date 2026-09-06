/** Calendar helpers. Dates are handled as local `YYYY-MM-DD` keys, never UTC instants. */
export type DateKey = string;

const WEEKDAY_LONG = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function toDateKey(date: Date): DateKey {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, d ?? 1);
}

export function addDays(key: DateKey, days: number): DateKey {
  const date = fromDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}

export function daysBetween(from: DateKey, to: DateKey): number {
  const a = fromDateKey(from).getTime();
  const b = fromDateKey(to).getTime();
  return Math.round((b - a) / 86_400_000);
}

export function dayOfWeek(key: DateKey): number {
  return fromDateKey(key).getDay();
}

export const isWeekend = (key: DateKey): boolean => [0, 6].includes(dayOfWeek(key));

export function weekdayLong(key: DateKey): string {
  return WEEKDAY_LONG[dayOfWeek(key)] ?? '';
}

export function weekdayShort(key: DateKey): string {
  return WEEKDAY_SHORT[dayOfWeek(key)] ?? '';
}

/** "Jan 18" */
export function monthDay(key: DateKey): string {
  const date = fromDateKey(key);
  return `${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/** "Sat, Jan 18" */
export function formatDateLabel(key: DateKey): string {
  const date = fromDateKey(key);
  return `${weekdayShort(key)}, ${MONTH_SHORT[date.getMonth()]} ${date.getDate()}`;
}

/** Human relative label: TODAY / TOMORROW / SATURDAY / Sat, Jan 18 */
export function relativeDateLabel(key: DateKey, today: DateKey): string {
  const delta = daysBetween(today, key);
  if (delta === 0) return 'TODAY';
  if (delta === 1) return 'TOMORROW';
  if (delta > 1 && delta < 7) return weekdayLong(key).toUpperCase();
  return formatDateLabel(key);
}

/** Next occurrence of `weekday` strictly after `from`, or `from` itself if it matches and includeToday. */
export function nextWeekday(from: DateKey, weekday: number, includeToday = true): DateKey {
  const start = dayOfWeek(from);
  let delta = (weekday - start + 7) % 7;
  if (delta === 0 && !includeToday) delta = 7;
  return addDays(from, delta);
}

export function dateRange(start: DateKey, days: number): DateKey[] {
  return Array.from({ length: Math.max(0, days) }, (_, i) => addDays(start, i));
}

/** US federal-ish holidays that visibly move ski traffic and crowds. Demo-scoped. */
export function holidayName(key: DateKey): string | null {
  const date = fromDateKey(key);
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dow = date.getDay();
  if (month === 12 && day >= 24 && day <= 31) return 'Christmas week';
  if (month === 1 && day === 1) return "New Year's Day";
  if (month === 1 && dow === 1 && day >= 15 && day <= 21) return 'MLK weekend';
  if (month === 2 && dow === 1 && day >= 15 && day <= 21) return 'Presidents Day weekend';
  return null;
}
