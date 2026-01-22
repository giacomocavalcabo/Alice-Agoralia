import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { getProjectConfig, resolveProjectPath } from '../lib/i18n/project-config';

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

    const memoryPath = resolveProjectPath(project, project.memoryFile);

    try {
      const content = await readFile(memoryPath, 'utf-8');
      const data = JSON.parse(content);
      return NextResponse.json(data);
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        return NextResponse.json({});
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

