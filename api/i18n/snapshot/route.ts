import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { getProjectConfig, resolveProjectPath, getSnapshotFileForLocale } from '@/lib/i18n/project-config';

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

    const snapshotFile = getSnapshotFileForLocale(project, project.sourceLocale);
    const snapshotPath = resolveProjectPath(project, snapshotFile);

    try {
      const content = await readFile(snapshotPath, 'utf-8');
      const data = JSON.parse(content);
      return NextResponse.json(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return NextResponse.json(null);
      }
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

