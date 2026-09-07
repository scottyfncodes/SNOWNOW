import type { Currency } from '@/domain/pricing';

/**
 * Representative lift-ticket rates, as data.
 *
 * These are demo figures shaped like the real market: destination resorts price
 * a walk-up window ticket several times above what the same day costs booked
 * two weeks out, and independents sit far below the conglomerates. No
 * component imports this file — it is read only by the pricing provider, so a
 * live pricing feed replaces it without touching the UI or the optimiser.
 */
export interface TicketPricingProfile {
  mountainId: string;
  currency: Currency;
  /** Peak-season adult walk-up rate. */
  windowRate: number;
  /** What the same day costs booked well in advance. */
  advanceFloor: number;
  /** How aggressively this mountain flexes price with demand, 0..1. */
  dynamicRange: number;
}

export const TICKET_PRICING: Record<string, TicketPricingProfile> = {
  vail: { mountainId: 'vail', currency: 'USD', windowRate: 289, advanceFloor: 159, dynamicRange: 0.95 },
  'beaver-creek': { mountainId: 'beaver-creek', currency: 'USD', windowRate: 279, advanceFloor: 155, dynamicRange: 0.9 },
  breckenridge: { mountainId: 'breckenridge', currency: 'USD', windowRate: 259, advanceFloor: 142, dynamicRange: 0.9 },
  keystone: { mountainId: 'keystone', currency: 'USD', windowRate: 229, advanceFloor: 119, dynamicRange: 0.85 },
  'crested-butte': { mountainId: 'crested-butte', currency: 'USD', windowRate: 199, advanceFloor: 109, dynamicRange: 0.7 },
  'winter-park': { mountainId: 'winter-park', currency: 'USD', windowRate: 219, advanceFloor: 124, dynamicRange: 0.8 },
  purgatory: { mountainId: 'purgatory', currency: 'USD', windowRate: 119, advanceFloor: 76, dynamicRange: 0.45 },
};

/** A mountain with no published profile still gets a plausible, clearly-generic rate. */
export const DEFAULT_PRICING: Omit<TicketPricingProfile, 'mountainId'> = {
  currency: 'USD',
  windowRate: 199,
  advanceFloor: 115,
  dynamicRange: 0.7,
};

export const pricingFor = (mountainId: string): TicketPricingProfile =>
  TICKET_PRICING[mountainId] ?? { mountainId, ...DEFAULT_PRICING };
