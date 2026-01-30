/**
 * Pricing API - Public endpoint
 * 
 * GET /api/pricing - Get pricing plans
 * Query params:
 *   - country: ISO country code (IT, US, GB, etc.) -> determines currency AND tier
 *   - currency: Override currency (EUR, USD, GBP)
 *   - tier: Override tier (tier1, tier2, tier3)
 * 
 * This is the endpoint that Sito Agoralia and App Agoralia call.
 * 
 * Tiered Pricing:
 *   - tier1: Premium markets (US, UK, DE, FR, CH, JP, AU, SG) - highest prices
 *   - tier2: Growth markets (IT, ES, NL, BE, AT, CA, NZ, AE, IE) - medium prices
 *   - tier3: Emerging markets (PL, CZ, PT, GR, BR, MX, IN, ZA, etc.) - lowest prices
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  getPricingData, 
  getCurrencyForCountry, 
  getTierForCountry,
  getPricingForCurrencyAndTier,
} from '@/lib/pricing-db';

export const dynamic = 'force-dynamic';

// CORS headers for cross-origin requests from Sito/App
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Alice-Token',
  // Cache for 5 minutes, serve stale while revalidating
  'Cache-Control': 's-maxage=300, stale-while-revalidate=300',
};

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders });
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const countryCode = searchParams.get('country')?.toUpperCase();
    const currencyOverride = searchParams.get('currency')?.toUpperCase();
    const tierOverride = searchParams.get('tier')?.toLowerCase();

    const pricingData = await getPricingData();

    // Determine currency
    let currency = pricingData.default_currency;
    if (currencyOverride && pricingData.currency_symbols[currencyOverride]) {
      currency = currencyOverride;
    } else if (countryCode) {
      currency = getCurrencyForCountry(countryCode, pricingData.country_currency_map);
    }

    // Determine tier
    let tier = 'tier2'; // Default to tier2
    if (tierOverride && ['tier1', 'tier2', 'tier3'].includes(tierOverride)) {
      tier = tierOverride;
    } else if (countryCode && pricingData.tiers) {
      tier = getTierForCountry(countryCode, pricingData.tiers);
    }

    // Get plans with pricing for this currency and tier
    const plans = getPricingForCurrencyAndTier(
      pricingData.plans, 
      currency, 
      tier,
      pricingData.tiers
    );

    const response = {
      plans,
      currency,
      currency_symbol: pricingData.currency_symbols[currency] || '€',
      country_code: countryCode || null,
      tier,
      tier_name: pricingData.tiers?.[tier]?.name || tier,
      version: pricingData.version,
      billing: pricingData.billing,
      stripe_products: pricingData.stripe_products,
    };

    return NextResponse.json(response, { headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching pricing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing' },
      { status: 500, headers: corsHeaders }
    );
  }
}
