import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

const PROGRESS_DIR = join(process.cwd(), '..', 'scripts');

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale');
    const project = searchParams.get('project') || 'site';

    if (!locale) {
      return NextResponse.json(
        { error: 'Locale parameter required' },
        { status: 400 }
      );
    }

    const progressFile = join(PROGRESS_DIR, `translation_progress_${project}_${locale.toLowerCase()}.json`);

    try {
      const content = await readFile(progressFile, 'utf-8');
      const data = JSON.parse(content);
      return NextResponse.json(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File non esiste = traduzione non in corso o completata
        return NextResponse.json(null);
      }
      throw error;
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

