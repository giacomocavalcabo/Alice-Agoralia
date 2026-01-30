/**
 * i18n Translate API
 * 
 * POST /api/i18n/translate
 * 
 * Translates missing keys using Grok API
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { PROJECTS, GROK_PRICING, estimateTokens } from '@/lib/i18n-config';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes for large translations

interface TranslateRequest {
  project: string;
  targetLocale: string;
  dryRun?: boolean;
}

interface TranslationResult {
  locale: string;
  keysTranslated: number;
  tokensUsed: { input: number; output: number };
  cost: number;
  files: string[];
  errors: string[];
}

// Load JSON file
async function loadJson(filePath: string): Promise<any> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

// Save JSON file
async function saveJson(filePath: string, data: any): Promise<void> {
  const dir = path.dirname(filePath);
  await fs.mkdir(dir, { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

// Check if file exists
async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

// Flatten nested JSON
function flattenJson(obj: any, prefix = ''): Record<string, string> {
  const result: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      Object.assign(result, flattenJson(value, newKey));
    } else if (typeof value === 'string') {
      result[newKey] = value;
    }
  }
  
  return result;
}

// Unflatten JSON back to nested structure
function unflattenJson(flat: Record<string, string>): any {
  const result: any = {};
  
  for (const [key, value] of Object.entries(flat)) {
    const parts = key.split('.');
    let current = result;
    
    for (let i = 0; i < parts.length - 1; i++) {
      if (!(parts[i] in current)) {
        current[parts[i]] = {};
      }
      current = current[parts[i]];
    }
    
    current[parts[parts.length - 1]] = value;
  }
  
  return result;
}

// Call Grok API for translation
async function translateWithGrok(
  texts: Record<string, string>,
  targetLanguage: string,
  context: string
): Promise<{ translations: Record<string, string>; tokens: { input: number; output: number } }> {
  const apiKey = process.env.GROK_API_KEY;
  
  if (!apiKey) {
    throw new Error('GROK_API_KEY not configured');
  }

  // Prepare batch for translation
  const entries = Object.entries(texts);
  const textsForTranslation = entries.map(([key, value]) => ({
    key,
    text: value
  }));

  const systemPrompt = `You are a professional translator for a SaaS drone management platform called Agoralia.
Translate the following JSON values to ${targetLanguage}.
Keep placeholders like {name}, {{variable}}, %s, %d unchanged.
Maintain the same tone: professional but friendly.
Do not translate brand names like "Agoralia".
Respond ONLY with a JSON object mapping keys to translated values.`;

  const userPrompt = `Context: ${context}

Translate these texts to ${targetLanguage}:

${JSON.stringify(textsForTranslation, null, 2)}

Respond with JSON only: { "key1": "translated1", "key2": "translated2", ... }`;

  const response = await fetch('https://api.x.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: GROK_PRICING.model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.3,
      max_tokens: 16000,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Grok API error: ${error}`);
  }

  const data = await response.json();
  const content = data.choices[0].message.content;
  
  // Extract JSON from response (might be wrapped in markdown)
  let jsonStr = content;
  const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) {
    jsonStr = jsonMatch[1];
  }
  
  const translations = JSON.parse(jsonStr.trim());
  
  return {
    translations,
    tokens: {
      input: data.usage?.prompt_tokens || estimateTokens(userPrompt),
      output: data.usage?.completion_tokens || estimateTokens(content),
    }
  };
}

// Chunk large translations
function chunkEntries(entries: [string, string][], maxChunkSize: number = 50): [string, string][][] {
  const chunks: [string, string][][] = [];
  
  for (let i = 0; i < entries.length; i += maxChunkSize) {
    chunks.push(entries.slice(i, i + maxChunkSize));
  }
  
  return chunks;
}

export async function POST(request: NextRequest) {
  try {
    // Check admin auth
    const authHeader = request.headers.get('Authorization');
    const adminKey = process.env.ADMIN_API_KEY;
    
    if (process.env.NODE_ENV !== 'development') {
      if (!authHeader || !adminKey || authHeader !== `Bearer ${adminKey}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    const body: TranslateRequest = await request.json();
    const { project: projectId, targetLocale, dryRun = false } = body;

    // Validate project
    const project = PROJECTS.find(p => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Check Grok API key
    if (!dryRun && !process.env.GROK_API_KEY) {
      return NextResponse.json({ error: 'GROK_API_KEY not configured' }, { status: 500 });
    }

    const result: TranslationResult = {
      locale: targetLocale,
      keysTranslated: 0,
      tokensUsed: { input: 0, output: 0 },
      cost: 0,
      files: [],
      errors: [],
    };

    // Process each file pattern
    for (const fileConfig of project.files) {
      try {
        // Load source file
        const sourceFileName = fileConfig.pattern.replace('{locale}', project.sourceLocale);
        const sourceFilePath = path.join(project.basePath, sourceFileName);
        
        const sourceData = await loadJson(sourceFilePath);
        if (!sourceData) {
          result.errors.push(`Source file not found: ${sourceFileName}`);
          continue;
        }

        // Load target file (if exists)
        const targetFileName = fileConfig.pattern.replace('{locale}', targetLocale);
        const targetFilePath = path.join(project.basePath, targetFileName);
        
        let targetData = await loadJson(targetFilePath) || {};

        // Find missing keys
        const sourceFlat = flattenJson(sourceData);
        const targetFlat = flattenJson(targetData);
        
        const missingKeys: Record<string, string> = {};
        for (const [key, value] of Object.entries(sourceFlat)) {
          if (!(key in targetFlat)) {
            missingKeys[key] = value;
          }
        }

        if (Object.keys(missingKeys).length === 0) {
          continue; // No missing keys for this file
        }

        if (dryRun) {
          // Just estimate
          const tokens = estimateTokens(missingKeys);
          result.keysTranslated += Object.keys(missingKeys).length;
          result.tokensUsed.input += tokens;
          result.tokensUsed.output += Math.ceil(tokens * 1.2);
          result.files.push(targetFileName);
          continue;
        }

        // Translate in chunks
        const entries = Object.entries(missingKeys);
        const chunks = chunkEntries(entries, 50);
        
        const allTranslations: Record<string, string> = {};
        
        for (const chunk of chunks) {
          const chunkObj = Object.fromEntries(chunk);
          const context = `File: ${sourceFileName}, translating UI text for drone management platform`;
          
          try {
            const { translations, tokens } = await translateWithGrok(
              chunkObj,
              targetLocale,
              context
            );
            
            Object.assign(allTranslations, translations);
            result.tokensUsed.input += tokens.input;
            result.tokensUsed.output += tokens.output;
          } catch (error) {
            result.errors.push(`Translation error: ${error instanceof Error ? error.message : 'Unknown'}`);
          }
        }

        // Merge translations
        const mergedFlat = { ...targetFlat, ...allTranslations };
        const mergedData = unflattenJson(mergedFlat);
        
        // Save file
        await saveJson(targetFilePath, mergedData);
        
        result.keysTranslated += Object.keys(allTranslations).length;
        result.files.push(targetFileName);

      } catch (error) {
        result.errors.push(`File error: ${error instanceof Error ? error.message : 'Unknown'}`);
      }
    }

    // Calculate cost
    result.cost = (result.tokensUsed.input / 1_000_000) * GROK_PRICING.inputCostPer1M +
                  (result.tokensUsed.output / 1_000_000) * GROK_PRICING.outputCostPer1M;

    return NextResponse.json({
      success: true,
      dryRun,
      result,
    });

  } catch (error) {
    console.error('Translation error:', error);
    return NextResponse.json(
      { error: 'Translation failed', details: String(error) },
      { status: 500 }
    );
  }
}
