/**
 * Catalogues API
 * 
 * GET /api/catalogues - List all catalogues from Agoralia App
 * GET /api/catalogues?file=languages/ui-locales.json - Get specific file
 * 
 * Reads from /Users/macbook/Desktop/Agoralia/catalogues/
 */

import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

const CATALOGUES_PATH = '/Users/macbook/Desktop/Agoralia/catalogues';

interface CatalogueFile {
  name: string;
  path: string;
  category: string;
  size: number;
  description?: string;
}

interface CatalogueCategory {
  name: string;
  description: string;
  files: CatalogueFile[];
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function getFileDescription(filePath: string): Promise<string | undefined> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.description;
  } catch {
    return undefined;
  }
}

async function scanCatalogues(): Promise<CatalogueCategory[]> {
  const categories: CatalogueCategory[] = [];
  
  const categoryDescriptions: Record<string, string> = {
    'countries': 'Country mappings: name → ISO, prefixes',
    'languages': 'UI locales, voice/call languages (Retell/Vapi)',
    'voices': 'Voice providers and fallback voices',
    'models': 'LLM models for agents',
    'billing': 'Payment methods, locale mappings',
    'compliance': 'B2B regimes, compliance rules by country (quiet hours, DNC, AI disclosure)',
    'pricing': 'Operational costs: RetellAI and Vapi (voice engines, LLMs, telephony, addons)',
    'telephony': 'Telnyx phone coverage by country (Local, Toll-Free, Mobile, features)',
  };

  try {
    const entries = await fs.readdir(CATALOGUES_PATH, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const categoryPath = path.join(CATALOGUES_PATH, entry.name);
        const files: CatalogueFile[] = [];
        
        const categoryFiles = await fs.readdir(categoryPath);
        
        for (const fileName of categoryFiles) {
          if (fileName.endsWith('.json')) {
            const filePath = path.join(categoryPath, fileName);
            const stats = await fs.stat(filePath);
            const description = await getFileDescription(filePath);
            
            files.push({
              name: fileName,
              path: `${entry.name}/${fileName}`,
              category: entry.name,
              size: stats.size,
              description,
            });
          }
        }
        
        if (files.length > 0) {
          categories.push({
            name: entry.name,
            description: categoryDescriptions[entry.name] || entry.name,
            files,
          });
        }
      }
    }
  } catch (error) {
    console.error('Error scanning catalogues:', error);
  }
  
  return categories.sort((a, b) => a.name.localeCompare(b.name));
}

async function getFileContent(filePath: string): Promise<any> {
  const fullPath = path.join(CATALOGUES_PATH, filePath);
  
  if (!fullPath.startsWith(CATALOGUES_PATH)) {
    throw new Error('Invalid path');
  }
  
  const content = await fs.readFile(fullPath, 'utf-8');
  return JSON.parse(content);
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const file = searchParams.get('file');
    
    if (file) {
      // Get specific file content
      const content = await getFileContent(file);
      return NextResponse.json({
        file,
        content,
      });
    }
    
    // List all catalogues
    const categories = await scanCatalogues();
    
    // Get README content
    let readme = '';
    const readmePath = path.join(CATALOGUES_PATH, 'README.md');
    if (await fileExists(readmePath)) {
      readme = await fs.readFile(readmePath, 'utf-8');
    }
    
    return NextResponse.json({
      basePath: CATALOGUES_PATH,
      categories,
      totalFiles: categories.reduce((sum, cat) => sum + cat.files.length, 0),
      readme,
    });
  } catch (error) {
    console.error('Error in catalogues API:', error);
    return NextResponse.json(
      { error: 'Failed to load catalogues', details: String(error) },
      { status: 500 }
    );
  }
}
