/**
 * Monitoring API - Read data from App Database
 * 
 * GET /api/monitoring
 * GET /api/monitoring?type=calls|stats|revenue
 * 
 * Returns monitoring data from the App PostgreSQL database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  checkConnection,
  getActiveCalls,
  getCallStats,
  getRevenueStats,
  getMarginStats,
  getCampaignMargins,
  getDailyMargins,
} from '@/lib/app-db';

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
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    // Check database connection first
    const isConnected = await checkConnection();
    
    if (!isConnected) {
      return NextResponse.json({
        connected: false,
        error: 'Cannot connect to App database',
        message: 'Make sure APP_DATABASE_URL is configured correctly',
      });
    }

    // Return specific data type
    if (type === 'calls') {
      const activeCalls = await getActiveCalls();
      return NextResponse.json({
        connected: true,
        active_calls: activeCalls,
        count: activeCalls.length,
      });
    }

    if (type === 'stats') {
      const callStats = await getCallStats();
      return NextResponse.json({
        connected: true,
        stats: callStats,
      });
    }

    if (type === 'revenue') {
      const revenueStats = await getRevenueStats();
      return NextResponse.json({
        connected: true,
        revenue: revenueStats,
      });
    }

    if (type === 'margins') {
      const [marginStats, campaignMargins, dailyMargins] = await Promise.all([
        getMarginStats(),
        getCampaignMargins(),
        getDailyMargins(),
      ]);
      return NextResponse.json({
        connected: true,
        margins: marginStats,
        by_campaign: campaignMargins,
        daily_trend: dailyMargins,
      });
    }

    // Return all data
    const [activeCalls, callStats, revenueStats] = await Promise.all([
      getActiveCalls(),
      getCallStats(),
      getRevenueStats(),
    ]);

    return NextResponse.json({
      connected: true,
      timestamp: new Date().toISOString(),
      active_calls: {
        count: activeCalls.length,
        calls: activeCalls,
      },
      call_stats: callStats,
      revenue_stats: revenueStats,
    });
  } catch (error) {
    console.error('Error in monitoring API:', error);
    return NextResponse.json(
      { 
        connected: false,
        error: 'Failed to fetch monitoring data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
