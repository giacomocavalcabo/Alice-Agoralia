/**
 * i18n Config API
 * 
 * GET /api/i18n/config
 * 
 * Returns configuration status (API keys, credits, etc.)
 */

import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TEAM_ID = '3a025eb4-be6b-4567-b293-eec4b60017af';

async function getGrokCredits(): Promise<number | null> {
  const mgmtKey = process.env.XAI_MANAGEMENT_KEY;
  if (!mgmtKey) return null;

  try {
    const res = await fetch(
      `https://management-api.x.ai/v1/billing/teams/${TEAM_ID}/prepaid/balance`,
      {
        headers: { 'Authorization': `Bearer ${mgmtKey}` },
        cache: 'no-store',
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    // total.val is in cents (negative means credit available)
    // e.g., -882 means $8.82 credit
    const totalCents = parseInt(data.total?.val || '0', 10);
    return Math.abs(totalCents) / 100;
  } catch {
    return null;
  }
}

export async function GET() {
  const grokKey = process.env.GROK_API_KEY;
  const githubToken = process.env.GITHUB_TOKEN;
  const mgmtKey = process.env.XAI_MANAGEMENT_KEY;

  // Fetch credits if management key is configured
  const credits = mgmtKey ? await getGrokCredits() : null;
  
  return NextResponse.json({
    grokConfigured: !!grokKey && grokKey.length > 10,
    githubConfigured: !!githubToken && githubToken.length > 10,
    grokModel: 'grok-4-fast-non-reasoning',
    credits, // null if not available, otherwise dollar amount
  });
}
