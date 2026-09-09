import { describe, expect, it } from 'vitest';
import { DEFAULT_PRICING, TICKET_PRICING, estimatedRangeFor, pricingFor } from './pricing';

describe('estimatedRangeFor', () => {
  it('spans the advance floor to the window rate for a known mountain', () => {
    const profile = TICKET_PRICING.vail!;
    expect(estimatedRangeFor('vail')).toEqual({
      low: profile.advanceFloor,
      high: profile.windowRate,
      currency: profile.currency,
    });
  });

  it('falls back to the generic profile for an unlisted mountain, same as pricingFor', () => {
    const range = estimatedRangeFor('not-a-real-mountain');
    expect(range).toEqual({
      low: DEFAULT_PRICING.advanceFloor,
      high: DEFAULT_PRICING.windowRate,
      currency: DEFAULT_PRICING.currency,
    });
  });

  it('never has a low above the high, for every mountain', () => {
    for (const id of Object.keys(TICKET_PRICING)) {
      const range = estimatedRangeFor(id);
      expect(range.low).toBeLessThanOrEqual(range.high);
      expect(range).toEqual(
        expect.objectContaining({ currency: pricingFor(id).currency }),
      );
    }
  });
});
