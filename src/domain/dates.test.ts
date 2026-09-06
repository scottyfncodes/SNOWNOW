import { describe, expect, it } from 'vitest';
import {
  addDays,
  dateRange,
  daysBetween,
  holidayName,
  isWeekend,
  nextWeekday,
  relativeDateLabel,
  toDateKey,
  weekdayLong,
} from './dates';

describe('date keys', () => {
  it('formats local dates without drifting through UTC', () => {
    expect(toDateKey(new Date(2026, 0, 1, 23, 30))).toBe('2026-01-01');
  });

  it('adds days across month boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01');
    expect(daysBetween('2026-01-31', '2026-02-03')).toBe(3);
  });

  it('knows its weekends', () => {
    expect(isWeekend('2026-01-17')).toBe(true); // Saturday
    expect(isWeekend('2026-01-20')).toBe(false);
    expect(weekdayLong('2026-01-17')).toBe('Saturday');
  });
});

describe('relative labels', () => {
  const today = '2026-01-14'; // Wednesday

  it('names today and tomorrow', () => {
    expect(relativeDateLabel(today, today)).toBe('TODAY');
    expect(relativeDateLabel('2026-01-15', today)).toBe('TOMORROW');
  });

  it('names days inside the coming week', () => {
    expect(relativeDateLabel('2026-01-17', today)).toBe('SATURDAY');
  });

  it('falls back to a date beyond a week', () => {
    expect(relativeDateLabel('2026-01-28', today)).toBe('Wed, Jan 28');
  });
});

describe('weekday selection', () => {
  it('finds the next Saturday, excluding today', () => {
    expect(nextWeekday('2026-01-17', 6, false)).toBe('2026-01-24');
    expect(nextWeekday('2026-01-17', 6, true)).toBe('2026-01-17');
  });

  it('builds contiguous ranges', () => {
    expect(dateRange('2026-01-17', 3)).toEqual(['2026-01-17', '2026-01-18', '2026-01-19']);
    expect(dateRange('2026-01-17', 0)).toEqual([]);
  });
});

describe('holidays that move ski traffic', () => {
  it('recognises the big crowd drivers', () => {
    expect(holidayName('2026-12-26')).toBe('Christmas week');
    expect(holidayName('2026-01-19')).toBe('MLK weekend');
    expect(holidayName('2026-03-11')).toBeNull();
  });
});
