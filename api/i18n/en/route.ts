import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { getProjectConfig, resolveProjectPath, getSourceFiles } from '@/lib/i18n/project-config';

const DEFAULT_PROJECT = 'site';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project') || DEFAULT_PROJECT;

    const project = await getProjectConfig(projectId);
    if (!project) {
      return NextResponse.json(
        { error: `Project "${projectId}" not found` },
        { status: 404 }
      );
    }

    // Carica tutti i file sorgente (supporta file multipli come pages.json + email.json)
    const sourceFiles = getSourceFiles(project);
    let enData: any = {};
    let foundAny = false;

    for (const sourceFileInfo of sourceFiles) {
      const enFile = resolveProjectPath(project, sourceFileInfo.file);
      try {
        const content = await readFile(enFile, 'utf-8');
        const fileData = JSON.parse(content);
        // Unisci i dati (se ci sono chiavi duplicate, l'ultimo file vince)
        enData = { ...enData, ...fileData };
        foundAny = true;
      } catch (error: any) {
        if (error.code !== 'ENOENT') {
          // Errore diverso da "file non trovato", logga ma continua
          console.error(`Error reading ${enFile}:`, error);
        }
        // Continua con gli altri file
      }
    }

    if (!foundAny) {
      return NextResponse.json(
        { error: `No source files found for project ${projectId}` },
        { status: 404 }
      );
    }

    return NextResponse.json(enData);
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

