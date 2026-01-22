import { NextResponse } from 'next/server';
import { loadProjectsConfig } from '../lib/i18n/project-config';

export async function GET() {
  try {
    const config = await loadProjectsConfig();
    return NextResponse.json(config);
  } catch (error: any) {
    console.error('Error loading projects:', error);
    return NextResponse.json(
      { error: error.message },
      { status: 500 }
    );
  }
}

