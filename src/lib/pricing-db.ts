/**
 * Pricing Database - JSON-based storage for Alice
 * 
 * This is the source of truth for pricing.
 * Sito Agoralia and App Agoralia fetch pricing from Alice API.
 * 
 * Supports tiered pricing (tier1/tier2/tier3 by country)
 */

import { promises as fs } from 'fs';
import path from 'path';

const PRICING_FILE = path.join(process.cwd(), 'data', 'pricing.json');

export interface PlanPrice {
  monthly: number;
  yearly: number;
}

export interface TieredPrice {
  [tier: string]: {
    [currency: string]: PlanPrice;
  };
}

export interface StripePrices {
  [tier: string]: {
    monthly: string;
    yearly: string;
  };
}

export interface TierConfig {
  name: string;
  countries: string[];
}

export interface Plan {
  id: string;
  name: string;
  stripe_price_id_monthly?: string | null;
  stripe_price_id_yearly?: string | null;
  stripe_prices?: StripePrices;
  price: TieredPrice | Record<string, PlanPrice>;
  description: string;
  features: string[];
  limits: {
    minutes: number;
    languages: number;
    countries: number;
    integrations: number;
  };
  cta: string;
  popular: boolean;
}

export interface Addon {
  id: string;
  name: string;
  stripe_price_id: string | null;
  price: Record<string, Record<string, number>>;
  description: string;
}

export interface PricingData {
  version: number;
  updated_at: string;
  default_currency: string;
  stripe_products?: {
    core: string;
    pro: string;
  };
  tiers?: Record<string, TierConfig>;
  plans: Plan[];
  addons: Addon[];
  billing: {
    yearly_discount_percent: number;
  };
  country_currency_map: Record<string, string>;
  currency_symbols: Record<string, string>;
}

/**
 * Read pricing data from JSON file
 */
export async function getPricingData(): Promise<PricingData> {
  const data = await fs.readFile(PRICING_FILE, 'utf-8');
  return JSON.parse(data);
}

/**
 * Write pricing data to JSON file
 */
export async function savePricingData(data: PricingData): Promise<void> {
  data.updated_at = new Date().toISOString();
  data.version = (data.version || 0) + 1;
  await fs.writeFile(PRICING_FILE, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Get currency for a country code
 */
export function getCurrencyForCountry(
  countryCode: string,
  countryMap: Record<string, string>
): string {
  return countryMap[countryCode] || countryMap['default'] || 'EUR';
}

/**
 * Get tier for a country code
 */
export function getTierForCountry(
  countryCode: string,
  tiers: Record<string, TierConfig>
): string {
  for (const [tierName, tierConfig] of Object.entries(tiers)) {
    if (tierConfig.countries.includes(countryCode) || tierConfig.countries.includes('default')) {
      return tierName;
    }
  }
  return 'tier3'; // Default to tier3 (emerging markets)
}

/**
 * Check if price object is tiered (has tier1/tier2/tier3 keys)
 */
function isTieredPrice(price: any): price is TieredPrice {
  return price && (price.tier1 || price.tier2 || price.tier3);
}

/**
 * Get pricing for a specific currency and tier
 */
export function getPricingForCurrencyAndTier(
  plans: Plan[],
  currency: string,
  tier: string,
  tiers?: Record<string, TierConfig>
): Array<{
  id: string;
  name: string;
  price: PlanPrice;
  stripe_price_id_monthly: string | null;
  stripe_price_id_yearly: string | null;
  description: string;
  features: string[];
  limits: Plan['limits'];
  cta: string;
  popular: boolean;
}> {
  return plans.map(plan => {
    let price: PlanPrice;
    let stripePriceMonthly: string | null = null;
    let stripePriceYearly: string | null = null;

    if (isTieredPrice(plan.price)) {
      // Tiered pricing (core, pro)
      const tierPrices = plan.price[tier] || plan.price['tier3'];
      price = tierPrices[currency] || tierPrices['EUR'] || { monthly: 0, yearly: 0 };
      
      // Get Stripe price IDs for this tier
      if (plan.stripe_prices && plan.stripe_prices[tier]) {
        stripePriceMonthly = plan.stripe_prices[tier].monthly;
        stripePriceYearly = plan.stripe_prices[tier].yearly;
      }
    } else {
      // Flat pricing (free plan)
      price = (plan.price as Record<string, PlanPrice>)[currency] || 
              (plan.price as Record<string, PlanPrice>)['EUR'] || 
              { monthly: 0, yearly: 0 };
      stripePriceMonthly = plan.stripe_price_id_monthly || null;
      stripePriceYearly = plan.stripe_price_id_yearly || null;
    }

    return {
      id: plan.id,
      name: plan.name,
      price,
      stripe_price_id_monthly: stripePriceMonthly,
      stripe_price_id_yearly: stripePriceYearly,
      description: plan.description,
      features: plan.features,
      limits: plan.limits,
      cta: plan.cta,
      popular: plan.popular,
    };
  });
}

/**
 * Legacy: Get pricing for a specific currency (no tier)
 * @deprecated Use getPricingForCurrencyAndTier instead
 */
export function getPricingForCurrency(
  plans: Plan[],
  currency: string
): Array<{
  id: string;
  name: string;
  price: PlanPrice;
  description: string;
  features: string[];
  limits: Plan['limits'];
  cta: string;
  popular: boolean;
}> {
  // Default to tier2 for backwards compatibility
  return getPricingForCurrencyAndTier(plans, currency, 'tier2').map(p => ({
    id: p.id,
    name: p.name,
    price: p.price,
    description: p.description,
    features: p.features,
    limits: p.limits,
    cta: p.cta,
    popular: p.popular,
  }));
}
