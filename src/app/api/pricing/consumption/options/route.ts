/**
 * Consumption Options API
 * 
 * GET /api/pricing/consumption/options
 * 
 * Returns available LLM and TTS options for consumption pricing.
 * Used by Sito Agoralia and App Agoralia to populate dropdowns.
 * 
 * Response cached for 5 minutes at Vercel Edge.
 */

import { NextResponse } from 'next/server';

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

// LLM options with their cost multipliers
const LLM_OPTIONS = [
  { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Default)', cost_multiplier: 1.0, default: true },
  { id: 'gpt-4o', name: 'GPT-4o', cost_multiplier: 1.5 },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', cost_multiplier: 1.8 },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', cost_multiplier: 1.0 },
  { id: 'claude-3-sonnet', name: 'Claude 3.5 Sonnet', cost_multiplier: 1.6 },
  { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash', cost_multiplier: 0.9 },
  { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', cost_multiplier: 1.4 },
];

// TTS options with their cost per minute (in cents)
const TTS_OPTIONS = [
  { id: 'deepgram', name: 'Deepgram (Default)', cost_cents_per_minute: 4, default: true },
  { id: 'elevenlabs', name: 'ElevenLabs', cost_cents_per_minute: 12 },
  { id: 'playht', name: 'PlayHT', cost_cents_per_minute: 8 },
  { id: 'azure', name: 'Azure TTS', cost_cents_per_minute: 6 },
  { id: 'openai', name: 'OpenAI TTS', cost_cents_per_minute: 10 },
  { id: 'cartesia', name: 'Cartesia', cost_cents_per_minute: 7 },
];

export async function GET() {
  try {
    return NextResponse.json({
      llms: LLM_OPTIONS,
      tts: TTS_OPTIONS,
      version: '1.0.0',
      note: 'Cost multipliers and per-minute costs are estimates. Actual costs may vary.',
    }, { headers: corsHeaders });
  } catch (error) {
    console.error('Error fetching consumption options:', error);
    return NextResponse.json(
      { error: 'Failed to fetch consumption options' },
      { status: 500, headers: corsHeaders }
    );
  }
}
