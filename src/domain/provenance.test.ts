import { describe, expect, it } from 'vitest';
import {
  confidenceForHorizon,
  displayStatus,
  observationForHorizon,
  ok,
  unavailable,
  weakestConfidence,
  type Provenance,
} from './provenance';

const liveProvenance = (overrides: Partial<Provenance> = {}): Provenance => ({
  source: 'live',
  observation: 'observed',
  confidence: 'high',
  provider: 'test-provider',
  horizonDays: 0,
  ...overrides,
});

describe('displayStatus — the four words the UI is allowed to use', () => {
  it('calls demo data DEMO, no matter how fresh it looks', () => {
    const availability = ok('x', { ...liveProvenance(), source: 'demo' });
    expect(displayStatus(availability)).toBe('demo');
  });

  it('calls fresh live data LIVE', () => {
    const fetchedAt = new Date('2026-01-17T08:00:00Z');
    const validUntil = new Date('2026-01-17T08:30:00Z');
    const availability = ok('x', {
      ...liveProvenance(),
      fetchedAt: fetchedAt.toISOString(),
      validUntil: validUntil.toISOString(),
    });
    const now = new Date('2026-01-17T08:10:00Z');
    expect(displayStatus(availability, now)).toBe('live');
  });

  it('calls live data past its freshness window STALE, not LIVE', () => {
    const availability = ok('x', {
      ...liveProvenance(),
      fetchedAt: new Date('2026-01-17T08:00:00Z').toISOString(),
      validUntil: new Date('2026-01-17T08:30:00Z').toISOString(),
    });
    const now = new Date('2026-01-17T09:00:00Z');
    expect(displayStatus(availability, now)).toBe('stale');
  });

  it('treats a live value with no validUntil as live for as long as it is held', () => {
    const availability = ok('x', liveProvenance());
    expect(displayStatus(availability, new Date('2099-01-01'))).toBe('live');
  });

  it('calls a failed fetch UNAVAILABLE regardless of what it would have been', () => {
    expect(displayStatus(unavailable('test', 'boom'))).toBe('unavailable');
  });

  it('never returns LIVE for anything not sourced live', () => {
    for (const source of ['demo'] as const) {
      const availability = ok('x', { ...liveProvenance(), source });
      expect(displayStatus(availability)).not.toBe('live');
    }
  });
});

describe('confidence and observation decay with lead time', () => {
  it('is high and observed for today', () => {
    expect(confidenceForHorizon(0)).toBe('high');
    expect(observationForHorizon(0)).toBe('observed');
  });

  it('is medium/forecast in the near term', () => {
    expect(confidenceForHorizon(4)).toBe('medium');
    expect(observationForHorizon(4)).toBe('forecast');
  });

  it('is low/projected far out', () => {
    expect(confidenceForHorizon(10)).toBe('low');
    expect(observationForHorizon(10)).toBe('projected');
  });

  it('weakestConfidence picks the worst of a mixed set', () => {
    expect(weakestConfidence(['high', 'medium', 'low'])).toBe('low');
    expect(weakestConfidence(['high', 'high'])).toBe('high');
    expect(weakestConfidence([])).toBe('low');
  });
});
