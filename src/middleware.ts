/**
 * Alice Middleware
 * 
 * Security:
 * 1. API routes (/api/pricing/*) require ALICE_API_TOKEN in header
 * 2. Admin routes (/admin/*) require Vercel Authentication (handled by Vercel)
 * 
 * The API token is shared with Sito and App Agoralia.
 * This prevents random people from scraping pricing data.
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require API token
const API_ROUTES = [
  '/api/pricing',
  '/api/catalogues',
  '/api/translations',
];

// Routes that are always public (health checks, etc.)
const PUBLIC_ROUTES = [
  '/api/health',
  '/api/monitoring/health',
];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow public routes
  if (PUBLIC_ROUTES.some(route => pathname.startsWith(route))) {
    return NextResponse.next();
  }
  
  // Check if this is a protected API route
  const isProtectedApiRoute = API_ROUTES.some(route => pathname.startsWith(route));
  
  if (isProtectedApiRoute) {
    // Get token from header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    
    // Also check X-Alice-Token header (alternative)
    const aliceToken = request.headers.get('x-alice-token');
    
    const providedToken = token || aliceToken;
    const expectedToken = process.env.ALICE_API_TOKEN;
    
    // If no token configured, allow all (dev mode)
    if (!expectedToken) {
      console.warn('⚠️ ALICE_API_TOKEN not configured - API is unprotected!');
      return NextResponse.next();
    }
    
    // Validate token
    if (!providedToken || providedToken !== expectedToken) {
      return NextResponse.json(
        { 
          error: 'Unauthorized',
          message: 'Valid API token required. Pass via Authorization: Bearer <token> or X-Alice-Token header.',
        },
        { 
          status: 401,
          headers: {
            'WWW-Authenticate': 'Bearer realm="Alice API"',
          }
        }
      );
    }
  }
  
  // Allow the request
  return NextResponse.next();
}

// Configure which routes use this middleware
export const config = {
  matcher: [
    // API routes
    '/api/:path*',
    // Admin routes (Vercel Auth handles these, but we can add extra checks)
    '/admin/:path*',
  ],
};
