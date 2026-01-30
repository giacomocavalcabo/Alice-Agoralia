/**
 * Pricing Admin API - Protected endpoint
 * 
 * GET /api/pricing/admin - Get full pricing data (with Stripe IDs)
 * PUT /api/pricing/admin - Update pricing data
 * 
 * Protected by ADMIN_API_KEY
 */

import { NextRequest, NextResponse } from 'next/server';
import { getPricingData, savePricingData, PricingData } from '@/lib/pricing-db';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-admin-key';

function isAuthorized(request: NextRequest): boolean {
  // In development, allow all requests
  if (process.env.NODE_ENV === 'development') return true;
  
  const authHeader = request.headers.get('Authorization');
  const apiKey = request.headers.get('X-API-Key');
  
  if (apiKey === ADMIN_API_KEY) return true;
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === ADMIN_API_KEY) return true;
  
  return false;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const pricingData = await getPricingData();
    return NextResponse.json(pricingData);
  } catch (error) {
    console.error('Error fetching pricing:', error);
    return NextResponse.json(
      { error: 'Failed to fetch pricing' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: PricingData = await request.json();
    
    // Validate required fields
    if (!body.plans || !Array.isArray(body.plans)) {
      return NextResponse.json(
        { error: 'Invalid pricing data: plans required' },
        { status: 400 }
      );
    }

    // Preserve version logic - savePricingData will increment
    await savePricingData(body);
    
    const updated = await getPricingData();
    return NextResponse.json({
      success: true,
      version: updated.version,
      updated_at: updated.updated_at,
    });
  } catch (error) {
    console.error('Error updating pricing:', error);
    return NextResponse.json(
      { error: 'Failed to update pricing' },
      { status: 500 }
    );
  }
}
