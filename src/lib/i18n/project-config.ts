import { readFile } from 'fs/promises';
import { join } from 'path';

export interface ProjectFile {
  pattern: string;
  snapshotPattern: string;
}

export interface ProjectConfig {
  id: string;
  name: string;
  basePath: string;
  sourceFile: string;
  sourceLocale: string;
  filePattern: string;
  snapshotPattern: string;
  memoryFile: string;
  files?: ProjectFile[]; // Opzionale: array di file per progetti multi-file
}

export interface ProjectsConfig {
  projects: ProjectConfig[];
}

let cachedConfig: ProjectsConfig | null = null;

export async function loadProjectsConfig(): Promise<ProjectsConfig> {
  if (cachedConfig) {
    return cachedConfig;
  }

  try {
    const configPath = join(process.cwd(), 'src', 'config', 'i18n-projects.json');
    const content = await readFile(configPath, 'utf-8');
    cachedConfig = JSON.parse(content);
    return cachedConfig!;
  } catch (error) {
    console.error('Error loading projects config:', error);
    // Fallback alla configurazione di default (solo Sito)
    return {
      projects: [
        {
          id: 'site',
          name: 'Sito',
          basePath: 'src/i18n',
          sourceFile: 'en-gb.json',
          sourceLocale: 'en-GB',
          filePattern: '{locale}.json',
          snapshotPattern: '{locale}.snapshot.json',
          memoryFile: '../scripts/translation_memory.json'
        }
      ]
    };
  }
}

export async function getProjectConfig(projectId: string): Promise<ProjectConfig | null> {
  const config = await loadProjectsConfig();
  return config.projects.find(p => p.id === projectId) || null;
}

export function resolveProjectPath(project: ProjectConfig, relativePath: string = ''): string {
  // Se basePath inizia con .., è relativo alla root del workspace
  // Altrimenti è relativo a process.cwd()
  if (project.basePath.startsWith('../')) {
    // process.cwd() in Next.js è in web/, quindi risali sempre di 1 livello per arrivare alla workspace root
    // Poi aggiungi 1 livello in più per ogni ../ nel basePath
    const parts = project.basePath.split('/');
    let upLevels = 0;
    const cleanParts: string[] = [];
    
    for (const part of parts) {
      if (part === '..') {
        upLevels++;
      } else {
        cleanParts.push(part);
      }
    }
    
    // Risali: 1 livello per uscire da web/, poi upLevels livelli aggiuntivi
    let workspaceRoot = process.cwd();
    for (let i = 0; i < upLevels + 1; i++) {
      workspaceRoot = join(workspaceRoot, '..');
    }
    
    // Normalizza il path per risolvere i percorsi relativi
    workspaceRoot = require('path').resolve(workspaceRoot);
    
    // Costruisci il path finale
    const cleanPath = cleanParts.join('/');
    return join(workspaceRoot, cleanPath, relativePath);
  }
  return join(process.cwd(), project.basePath, relativePath);
}

export function getFileForLocale(project: ProjectConfig, locale: string): string {
  const normalizedLocale = locale.toLowerCase();
  return project.filePattern.replace(/{locale}/g, normalizedLocale);
}

export function getSnapshotFileForLocale(project: ProjectConfig, locale: string): string {
  const normalizedLocale = locale.toLowerCase();
  return project.snapshotPattern.replace(/{locale}/g, normalizedLocale);
}

/**
 * Ottiene tutti i file per una locale (supporta progetti multi-file)
 */
export function getFilesForLocale(project: ProjectConfig, locale: string): Array<{ file: string; snapshot: string }> {
  const normalizedLocale = locale.toLowerCase();
  
  // Se il progetto ha un array `files`, usa quello
  if (project.files && project.files.length > 0) {
    return project.files.map(f => ({
      file: f.pattern.replace(/{locale}/g, normalizedLocale),
      snapshot: f.snapshotPattern.replace(/{locale}/g, normalizedLocale)
    }));
  }
  
  // Altrimenti usa il pattern singolo
  return [{
    file: getFileForLocale(project, locale),
    snapshot: getSnapshotFileForLocale(project, locale)
  }];
}

/**
 * Ottiene tutti i file sorgente (EN) per un progetto
 */
export function getSourceFiles(project: ProjectConfig): Array<{ file: string; snapshot: string }> {
  const normalizedLocale = project.sourceLocale.toLowerCase();
  
  // Se il progetto ha un array `files`, costruisci i path sorgente
  if (project.files && project.files.length > 0) {
    return project.files.map(f => ({
      file: f.pattern.replace(/{locale}/g, normalizedLocale),
      snapshot: f.snapshotPattern.replace(/{locale}/g, normalizedLocale)
    }));
  }
  
  // Altrimenti usa il sourceFile
  return [{
    file: project.sourceFile,
    snapshot: project.snapshotPattern.replace(/{locale}/g, normalizedLocale)
  }];
}

