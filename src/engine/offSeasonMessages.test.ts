import { describe, expect, it } from 'vitest';
import { testMountain, testWeather } from '@/test/fixtures';
import { buildOffSeasonMessage } from './offSeasonMessages';

describe('buildOffSeasonMessage', () => {
  it('is deterministic for the same mountain, date and state', () => {
    const mountain = testMountain();
    const a = buildOffSeasonMessage('OFF_SEASON', 'reason', mountain, '2026-07-15', null);
    const b = buildOffSeasonMessage('OFF_SEASON', 'reason', mountain, '2026-07-15', null);
    expect(a).toEqual(b);
  });

  it('produces a personality line for every non-skiable state', () => {
    const mountain = testMountain();
    for (const state of ['OFF_SEASON', 'NO_SNOW', 'INSUFFICIENT_COVERAGE', 'CLOSED'] as const) {
      const message = buildOffSeasonMessage(state, 'reason', mountain, '2026-07-15', null);
      expect(message).not.toBeNull();
      expect(message!.line.length).toBeGreaterThan(0);
      expect(message!.state).toBe(state);
    }
  });

  it('returns null for states that still get a normal recommendation', () => {
    const mountain = testMountain();
    for (const state of ['OPEN', 'OPEN_WITH_RESTRICTIONS', 'LIMITED_OPERATIONS'] as const) {
      expect(buildOffSeasonMessage(state, 'reason', mountain, '2026-07-15', null)).toBeNull();
    }
  });

  it('surfaces real projected snowfall in the off-season detail, never inventing a number', () => {
    const mountain = testMountain();
    const weather = testWeather({ past5TotalIn: 2, future5TotalIn: 18 });
    const message = buildOffSeasonMessage('OFF_SEASON', 'Next to nothing open.', mountain, '2026-10-15', weather);
    expect(message).not.toBeNull();
    expect(message!.detail).toMatch(/18/);
    expect(message!.detail).toMatch(/not soon/i);
  });

  it('does not promise incoming snow that was not actually forecast', () => {
    const mountain = testMountain();
    const weather = testWeather({ past5TotalIn: 0, future5TotalIn: 0 });
    const message = buildOffSeasonMessage('NO_SNOW', 'Real-time base depth is negligible.', mountain, '2026-10-15', weather);
    expect(message).not.toBeNull();
    expect(message!.detail).not.toMatch(/not soon/i);
  });

  it('varies the line across different mountains on the same day', () => {
    const lines = new Set(
      ['vail', 'breckenridge', 'keystone', 'purgatory', 'wolf-creek', 'loveland'].map(
        (id) => buildOffSeasonMessage('OFF_SEASON', 'reason', testMountain({ id }), '2026-07-15', null)!.line,
      ),
    );
    expect(lines.size).toBeGreaterThan(1);
  });
});
