/**
 * lib/pricing.ts
 * Tier-based pricing for verified case packages.
 * Minimum order: 25 cases.
 */

export const MIN_ORDER = 25;

export const PRICE_TIERS = [
  { minQty: 250, pricePerCase: 200, name: 'Scale'   },
  { minQty: 100, pricePerCase: 225, name: 'Growth'  },
  { minQty:  25, pricePerCase: 250, name: 'Starter' },
] as const;

export type TierName = 'Scale' | 'Growth' | 'Starter';

export function getPriceTier(qty: number): (typeof PRICE_TIERS)[number] {
  for (const tier of PRICE_TIERS) {
    if (qty >= tier.minQty) return tier;
  }
  return PRICE_TIERS[PRICE_TIERS.length - 1];
}

export interface PriceCalc {
  tierName:     TierName;
  pricePerCase: number;      // dollars
  totalCents:   number;      // total in cents for Stripe
  totalDollars: number;
}

export function calculateOrderPrice(qty: number): PriceCalc {
  const tier = getPriceTier(qty);
  const totalDollars = qty * tier.pricePerCase;
  return {
    tierName:     tier.name,
    pricePerCase: tier.pricePerCase,
    totalCents:   totalDollars * 100,
    totalDollars,
  };
}
