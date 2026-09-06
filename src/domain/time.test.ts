import { describe, expect, it } from 'vitest';
import {
  at,
  clamp,
  formatClock,
  formatClockShort,
  formatDelta,
  formatDuration,
  formatWindowLabel,
  lerp,
  minuteRange,
  overlapMinutes,
} from './time';

describe('clock formatting', () => {
  it('renders 12-hour times with a meridiem', () => {
    expect(formatClock(at(5, 18))).toBe('5:18 AM');
    expect(formatClock(at(14, 42))).toBe('2:42 PM');
    expect(formatClock(at(12, 0))).toBe('12:00 PM');
    expect(formatClock(at(0, 5))).toBe('12:05 AM');
  });

  it('wraps past midnight rather than showing 25:00', () => {
    expect(formatClock(at(25, 30))).toBe('1:30 AM');
  });

  it('drops the meridiem for dense labels', () => {
    expect(formatClockShort(at(16, 5))).toBe('4:05');
  });
});

describe('duration formatting', () => {
  it('uses the ski-day shorthand', () => {
    expect(formatDuration(106)).toBe('1h46');
    expect(formatDuration(47)).toBe('47m');
    expect(formatDuration(120)).toBe('2h');
    expect(formatDuration(0)).toBe('0m');
  });

  it('signs deltas', () => {
    expect(formatDelta(32)).toBe('+32m');
    expect(formatDelta(-18)).toBe('−18m');
    expect(formatDelta(0)).toBe('even');
  });
});

describe('window labels', () => {
  it('collapses the meridiem when both ends share it', () => {
    expect(formatWindowLabel(at(8, 10), at(10, 47))).toBe('8:10–10:47 AM');
  });

  it('keeps both when the window crosses noon', () => {
    expect(formatWindowLabel(at(11, 0), at(13, 0))).toBe('11:00 AM – 1:00 PM');
  });
});

describe('interval maths', () => {
  it('measures overlap between two windows', () => {
    expect(overlapMinutes(at(8), at(11), at(10), at(12))).toBe(60);
    expect(overlapMinutes(at(8), at(9), at(10), at(12))).toBe(0);
  });

  it('produces inclusive minute grids', () => {
    expect(minuteRange(0, 30, 10)).toEqual([0, 10, 20, 30]);
    expect(minuteRange(0, 30, 0)).toEqual([]);
  });

  it('clamps and interpolates', () => {
    expect(clamp(5, 0, 3)).toBe(3);
    expect(lerp(0, 10, 0.25)).toBe(2.5);
    expect(lerp(0, 10, 5)).toBe(10);
  });
});
