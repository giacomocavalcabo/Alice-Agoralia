/**
 * Translations Sync API
 * 
 * POST /api/translations/sync
 * 
 * Syncs translation files to GitHub repositories.
 * This triggers automatic deployments on Vercel (Sito) and Railway (App).
 * 
 * Body:
 * {
 *   "project": "sito" | "app",
 *   "files": [
 *     { "path": "src/i18n/it.json", "content": "{...}" }
 *   ],
 *   "message": "Update Italian translations"
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { syncFilesToGitHub, getRepoConfig } from '@/lib/github';

const ADMIN_API_KEY = process.env.ADMIN_API_KEY || 'dev-admin-key';

function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('Authorization');
  const apiKey = request.headers.get('X-API-Key');
  
  if (apiKey === ADMIN_API_KEY) return true;
  if (authHeader?.startsWith('Bearer ') && authHeader.slice(7) === ADMIN_API_KEY) return true;
  
  if (process.env.NODE_ENV === 'development') {
    const origin = request.headers.get('origin') || '';
    if (origin.includes('localhost')) return true;
  }
  
  return false;
}

interface SyncRequest {
  project: 'sito' | 'app';
  files: Array<{
    path: string;
    content: string;
  }>;
  message?: string;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: SyncRequest = await request.json();

    // Validate
    if (!body.project || !['sito', 'app'].includes(body.project)) {
      return NextResponse.json(
        { error: 'Invalid project: must be "sito" or "app"' },
        { status: 400 }
      );
    }

    if (!body.files || !Array.isArray(body.files) || body.files.length === 0) {
      return NextResponse.json(
        { error: 'No files provided' },
        { status: 400 }
      );
    }

    // Validate each file
    for (const file of body.files) {
      if (!file.path || !file.content) {
        return NextResponse.json(
          { error: 'Each file must have path and content' },
          { status: 400 }
        );
      }
    }

    const repo = getRepoConfig(body.project);
    const commitMessage = body.message || `[Alice] Update translations for ${body.project}`;

    const result = await syncFilesToGitHub(
      repo,
      body.files.map(f => ({
        path: f.path,
        content: f.content,
        message: commitMessage,
      })),
      commitMessage
    );

    return NextResponse.json({
      success: true,
      project: body.project,
      commit_sha: result.commit_sha,
      files_updated: result.files_updated,
      message: `Synced ${result.files_updated} file(s) to ${repo.owner}/${repo.repo}`,
    });
  } catch (error) {
    console.error('Error syncing translations:', error);
    return NextResponse.json(
      { 
        error: 'Failed to sync translations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
