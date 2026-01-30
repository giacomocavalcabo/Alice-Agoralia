/**
 * i18n Status API
 * 
 * GET /api/i18n/status?project=site|app
 * 
 * Scans translation files and returns status for all languages
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { ALL_LANGUAGES, COMPLIANCE_LANGUAGES, PROJECTS, estimateTokens, estimateCost } from '@/lib/i18n-config';

export const dynamic = 'force-dynamic';

interface LanguageStatus {
  code: string;
  name: string;
  flag: string;
  status: 'complete' | 'partial' | 'missing';
  keyCount: number;
  sourceKeyCount: number;
  progress: number;
  estimatedCost: number;
  files: string[];
}

interface ProjectStatus {
  projectId: string;
  projectName: string;
  sourceLocale: string;
  sourceKeyCount: number;
  languages: LanguageStatus[];
  totalLanguages: number;
  translatedLanguages: number;
  missingLanguages: number;
  totalEstimatedCost: number;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadJson(filePath: string): Promise<any> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function countKeys(obj: any, prefix = ''): number {
  if (obj === null || obj === undefined) return 0;
  if (typeof obj !== 'object') return 1;
  if (Array.isArray(obj)) {
    return obj.reduce((sum, item, idx) => sum + countKeys(item, `${prefix}[${idx}]`), 0);
  }
  return Object.entries(obj).reduce((sum, [key, value]) => {
    return sum + countKeys(value, prefix ? `${prefix}.${key}` : key);
  }, 0);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const projectId = searchParams.get('project') || 'site';

    const project = PROJECTS.find(p => p.id === projectId);
    if (!project) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 });
    }

    // Load source (EN) files
    let sourceData: any = {};
    let sourceKeyCount = 0;
    const sourceFiles: string[] = [];

    for (const fileConfig of project.files) {
      const sourceLocale = project.sourceLocale.toLowerCase();
      const fileName = fileConfig.pattern.replace('{locale}', sourceLocale);
      const filePath = path.join(project.basePath, fileName);
      
      if (await fileExists(filePath)) {
        const data = await loadJson(filePath);
        if (data) {
          sourceData = { ...sourceData, ...data };
          sourceKeyCount += countKeys(data);
          sourceFiles.push(fileName);
        }
      }
    }

    if (sourceKeyCount === 0) {
      return NextResponse.json({
        error: 'No source files found',
        projectId,
        basePath: project.basePath,
      }, { status: 404 });
    }

    // Check each language
    // For compliance project, use reduced language list (53 languages)
    // For other projects, use all 103 languages
    const languagesToCheck = projectId === 'compliance' 
      ? ALL_LANGUAGES.filter(l => COMPLIANCE_LANGUAGES.includes(l.code))
      : ALL_LANGUAGES;

    const languageStatuses: LanguageStatus[] = [];

    for (const lang of languagesToCheck) {
      // Skip source language
      if (lang.code.toLowerCase() === project.sourceLocale.toLowerCase()) {
        continue;
      }

      const localeForFile = lang.code; // Keep original case for folder names
      const localeLower = lang.code.toLowerCase();
      let targetData: any = {};
      let targetKeyCount = 0;
      const targetFiles: string[] = [];

      for (const fileConfig of project.files) {
        // Try both cases for locale
        const fileNameOriginal = fileConfig.pattern.replace('{locale}', localeForFile);
        const fileNameLower = fileConfig.pattern.replace('{locale}', localeLower);
        
        let filePath = path.join(project.basePath, fileNameOriginal);
        let exists = await fileExists(filePath);
        
        if (!exists) {
          filePath = path.join(project.basePath, fileNameLower);
          exists = await fileExists(filePath);
        }

        if (exists) {
          const data = await loadJson(filePath);
          if (data) {
            targetData = { ...targetData, ...data };
            targetKeyCount += countKeys(data);
            targetFiles.push(fileNameOriginal);
          }
        }
      }

      // Determine status
      let status: 'complete' | 'partial' | 'missing' = 'missing';
      let progress = 0;

      if (targetKeyCount > 0) {
        progress = Math.round((targetKeyCount / sourceKeyCount) * 100);
        status = progress >= 95 ? 'complete' : 'partial';
      }

      // Estimate cost for missing translations
      const missingKeys = Math.max(0, sourceKeyCount - targetKeyCount);
      const tokensToTranslate = estimateTokens(sourceData) * (missingKeys / sourceKeyCount);
      const estimatedCost = status === 'complete' ? 0 : estimateCost(tokensToTranslate, tokensToTranslate * 1.2);

      languageStatuses.push({
        code: lang.code,
        name: lang.name,
        flag: lang.flag,
        status,
        keyCount: targetKeyCount,
        sourceKeyCount,
        progress,
        estimatedCost: Math.round(estimatedCost * 10000) / 10000,
        files: targetFiles,
      });
    }

    // Sort: missing first, then partial, then complete
    languageStatuses.sort((a, b) => {
      const statusOrder = { missing: 0, partial: 1, complete: 2 };
      return statusOrder[a.status] - statusOrder[b.status];
    });

    const result: ProjectStatus = {
      projectId: project.id,
      projectName: project.name,
      sourceLocale: project.sourceLocale,
      sourceKeyCount,
      languages: languageStatuses,
      totalLanguages: languageStatuses.length,
      translatedLanguages: languageStatuses.filter(l => l.status === 'complete').length,
      missingLanguages: languageStatuses.filter(l => l.status === 'missing').length,
      totalEstimatedCost: languageStatuses.reduce((sum, l) => sum + l.estimatedCost, 0),
    };

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error in i18n status:', error);
    return NextResponse.json(
      { error: 'Failed to get translation status', details: String(error) },
      { status: 500 }
    );
  }
}
