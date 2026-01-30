/**
 * Consumption Pricing API
 * 
 * GET /api/pricing/consumption
 * GET /api/pricing/consumption?language=it-IT
 * GET /api/pricing/consumption?language=it-IT&llm=gpt-4o&tts=elevenlabs
 * 
 * Returns estimated per-minute costs for calls.
 * - language: determines if Retell or Vapi is needed
 * - llm: LLM model to use (affects cost)
 * - tts: TTS provider to use (affects cost)
 * 
 * Response cached for 5 minutes at Vercel Edge.
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

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

const CATALOGUES_PATH = '/Users/macbook/Desktop/Agoralia/catalogues';

// Retell core languages (31 codes)
const RETELL_LANGUAGES = [
  'en-US', 'en-GB', 'en-AU', 'en-IN', 'en-NZ',
  'es-ES', 'es-MX', 'es-AR',
  'fr-FR', 'fr-CA',
  'de-DE', 'de-AT', 'de-CH',
  'it-IT',
  'pt-PT', 'pt-BR',
  'nl-NL', 'nl-BE',
  'pl-PL',
  'ru-RU',
  'ja-JP',
  'ko-KR',
  'zh-CN', 'zh-TW', 'zh-HK',
  'ar-SA', 'ar-AE',
  'hi-IN',
  'tr-TR',
  'sv-SE',
  'da-DK'
];

// LLM cost multipliers (base cost × multiplier)
const LLM_MULTIPLIERS: Record<string, number> = {
  'gpt-4o-mini': 1.0,      // Default
  'gpt-4o': 1.5,
  'gpt-4-turbo': 1.8,
  'claude-3-haiku': 1.0,
  'claude-3-sonnet': 1.6,
  'gemini-1.5-flash': 0.9,
  'gemini-1.5-pro': 1.4,
};

// TTS cost per minute in cents
const TTS_COSTS: Record<string, number> = {
  'deepgram': 4,           // Default
  'elevenlabs': 12,
  'playht': 8,
  'azure': 6,
  'openai': 10,
  'cartesia': 7,
};

interface AgoraliaConfig {
  version: string;
  platform_costs: {
    vapi_base_cost_cents_per_minute: number;
  };
  vapi_cost_estimation: {
    method: string;
    use_retell_as_variable: boolean;
    buffer_percent: number;
  };
  agoralia_margins: {
    markup_percent: number;
  };
  fallback_costs: {
    llm_cents_per_minute: number;
    voice_cents_per_minute: number;
    telephony_cents_per_minute: number;
  };
}

async function loadAgoraliaConfig(): Promise<AgoraliaConfig> {
  const configPath = path.join(CATALOGUES_PATH, 'pricing', 'agoralia-config.json');
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Return defaults
    return {
      version: '1.0.0',
      platform_costs: { vapi_base_cost_cents_per_minute: 5 },
      vapi_cost_estimation: { method: 'retell_plus_buffer', use_retell_as_variable: true, buffer_percent: 10 },
      agoralia_margins: { markup_percent: 20 },
      fallback_costs: { llm_cents_per_minute: 7, voice_cents_per_minute: 10, telephony_cents_per_minute: 5 }
    };
  }
}

function determineProvider(language: string | null): 'retell' | 'vapi' {
  if (!language) return 'retell';
  
  // Normalize language code
  const normalized = language.replace('_', '-');
  
  // Check if Retell supports this language
  if (RETELL_LANGUAGES.some(l => l.toLowerCase() === normalized.toLowerCase())) {
    return 'retell';
  }
  
  // Check language family (e.g., "en" matches "en-US")
  const langFamily = normalized.split('-')[0].toLowerCase();
  if (RETELL_LANGUAGES.some(l => l.toLowerCase().startsWith(langFamily + '-'))) {
    return 'retell';
  }
  
  // Language requires Vapi/Azure
  return 'vapi';
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const language = searchParams.get('language');
    const llmId = searchParams.get('llm') || 'gpt-4o-mini';
    const ttsId = searchParams.get('tts') || 'deepgram';
    
    const config = await loadAgoraliaConfig();
    const provider = determineProvider(language);
    
    const markup = config.agoralia_margins.markup_percent;
    
    // Get LLM cost (base cost × multiplier)
    const llmMultiplier = LLM_MULTIPLIERS[llmId] || 1.0;
    const baseLlmCents = config.fallback_costs.llm_cents_per_minute;
    const llmCents = baseLlmCents * llmMultiplier;
    
    // Get TTS cost
    const voiceCents = TTS_COSTS[ttsId] || config.fallback_costs.voice_cents_per_minute;
    
    let baseCostCents: number;
    let platformCents = 0;
    
    if (provider === 'retell') {
      // Retell: LLM + Voice
      baseCostCents = llmCents + voiceCents;
    } else {
      // Vapi: 5¢ base + (Retell × 1.1)
      const vapiBase = config.platform_costs.vapi_base_cost_cents_per_minute;
      const buffer = 1 + (config.vapi_cost_estimation.buffer_percent / 100);
      const retellVariable = llmCents + voiceCents;
      
      platformCents = vapiBase;
      baseCostCents = vapiBase + (retellVariable * buffer);
    }
    
    // Apply Agoralia markup
    const totalCents = baseCostCents * (1 + markup / 100);
    
    return NextResponse.json({
      agoralia_cost_per_minute_cents: Math.round(totalCents * 10) / 10,
      provider,
      language: language || 'default (en)',
      llm: llmId,
      tts: ttsId,
      breakdown: {
        llm_cents: Math.round(llmCents * 10) / 10,
        llm_multiplier: llmMultiplier,
        voice_cents: voiceCents,
        platform_cents: platformCents,
        markup_percent: markup
      },
      config_version: config.version,
      note: 'Telephony costs depend on your provider and are NOT included. These costs are deducted from your Agoralia credit.',
      note_it: 'I costi telephony dipendono dal tuo provider e NON sono inclusi. Questi costi vengono scalati dal tuo credito Agoralia.'
    }, { headers: corsHeaders });
    
  } catch (error) {
    console.error('Error in consumption pricing API:', error);
    return NextResponse.json(
      { error: 'Failed to calculate consumption pricing' },
      { status: 500, headers: corsHeaders }
    );
  }
}
