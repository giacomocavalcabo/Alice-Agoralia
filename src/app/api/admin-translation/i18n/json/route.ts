import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { getProjectConfig, resolveProjectPath, getFilesForLocale } from '../lib/i18n/project-config';

const DEFAULT_PROJECT = 'site';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const locale = searchParams.get('locale');
    const projectId = searchParams.get('project') || DEFAULT_PROJECT;

    if (!locale) {
      return NextResponse.json(
        { error: 'Locale parameter required' },
        { status: 400 }
      );
    }

    const project = await getProjectConfig(projectId);
    if (!project) {
      return NextResponse.json(
        { error: `Project "${projectId}" not found` },
        { status: 404 }
      );
    }

    // Ottieni tutti i file per questa locale (supporta file multipli)
    const localeFiles = getFilesForLocale(project, locale);
    let allData: any = {};
    let foundAny = false;

    for (const fileInfo of localeFiles) {
      const filePath = resolveProjectPath(project, fileInfo.file);
      try {
        const content = await readFile(filePath, 'utf-8');
        const fileData = JSON.parse(content);
        // Unisci i dati (se ci sono chiavi duplicate, l'ultimo file vince)
        allData = { ...allData, ...fileData };
        foundAny = true;
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          // Errore diverso da "file non trovato", logga ma continua
          console.error(`Error reading ${filePath}:`, error);
        }
        // Continua con gli altri file
      }
    }

    if (!foundAny) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(allData);
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

