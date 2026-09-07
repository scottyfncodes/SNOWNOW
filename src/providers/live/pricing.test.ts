import { describe, expect, it } from 'vitest';
import { at } from '@/domain/time';
import { makeContext } from '@/engine/inputs';
import { testMountain } from '@/test/fixtures';
import { LivePricingProvider } from './pricing';

const context = makeContext('2026-01-17', '2026-01-17', at(5));

describe('LivePricingProvider — never presents the demo price as live', () => {
  it('reports unavailable for a resort with a known official ticket page, and names it in the reason', async () => {
    const vail = testMountain({ id: 'vail', name: 'Vail' });
    const provider = new LivePricingProvider();
    const result = await provider.getTicketPrice(vail, context);
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toContain('Vail');
    expect(result.reason).toMatch(/vail\.com/);
  });

  it('reports unavailable for a mountain with no known official page too — never guesses a URL', async () => {
    const unknown = testMountain({ id: 'nowhere', name: 'Nowhere Peak' });
    const provider = new LivePricingProvider();
    const result = await provider.getTicketPrice(unknown, context);
    expect(result.status).toBe('unavailable');
    if (result.status !== 'unavailable') return;
    expect(result.reason).toContain('Nowhere Peak');
  });

  it('is consistent across every mountain in the real dataset: always unavailable, never a fabricated price', async () => {
    const { MOUNTAINS } = await import('@/data/mountains');
    const provider = new LivePricingProvider();
    for (const mountain of MOUNTAINS) {
      const result = await provider.getTicketPrice(mountain, context);
      expect(result.status, `${mountain.id} should be unavailable`).toBe('unavailable');
    }
  });
});
