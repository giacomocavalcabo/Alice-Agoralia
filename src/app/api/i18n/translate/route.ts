import { NextResponse } from 'next/server';
import { exec } from 'child_process';
import { promisify } from 'util';
import { readFile } from 'fs/promises';
import { join } from 'path';

const execAsync = promisify(exec);
const SCRIPTS_DIR = join(process.cwd(), '..', 'scripts');
const CONFIG_FILE = join(SCRIPTS_DIR, 'model_language_config.json');

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { locale, createMissing, project = 'site' } = body;

    // Verifica GROK_API_KEY
    const envFile = join(process.cwd(), '..', '.env');
    let grokKey = '';
    try {
      const envContent = await readFile(envFile, 'utf-8');
      const match = envContent.match(/GROK_API_KEY=(.+)/);
      if (match) {
        grokKey = match[1].trim().replace(/^["']|["']$/g, '');
      }
    } catch {
      // .env non esiste o non ha la chiave
    }

    if (!grokKey || grokKey === 'YOUR_GROK_API_KEY_HERE') {
      return NextResponse.json(
        { error: 'GROK_API_KEY non configurata nel .env' },
        { status: 400 }
      );
    }

    // Costruisci comando
    let cmd = `cd "${SCRIPTS_DIR}" && GROK_API_KEY="${grokKey}" python3 sync_and_translate_grok_2026.py`;
    
    if (project) {
      cmd += ` --project ${project}`;
    }
    
    if (locale) {
      cmd += ` --locale ${locale}`;
    }
    
    if (createMissing) {
      cmd += ' --create-missing';
    }

    // Esegui script con timeout aumentato per traduzioni lunghe (KB project)
    // Per il KB project con 204 paesi, servono ~30-40 minuti
    const timeout = project === 'kb' ? 2400000 : 600000; // 40 minuti per KB, 10 per altri
    
    // Esegui script
    const { stdout, stderr } = await execAsync(cmd, {
      maxBuffer: 10 * 1024 * 1024, // 10MB
      timeout: timeout
    });

    // Parse output per successo
    const success = !stderr || !stderr.includes('❌');
    const output = stdout + (stderr || '');

    return NextResponse.json({
      success,
      output: output.split('\n').slice(-20).join('\n'), // Ultime 20 righe
      locale: locale || 'all'
    });
  } catch (error: any) {
    const errorMessage = error?.message || error?.toString() || 'Errore sconosciuto durante la traduzione';
    const errorOutput = error?.stdout || error?.stderr || error?.stack || '';
    
    console.error('Translation error:', error);
    
    return NextResponse.json(
      { 
        error: errorMessage,
        output: errorOutput
      },
      { status: 500 }
    );
  }
}

