/**
 * GitHub API Client for Alice
 * 
 * Used to sync translations to Sito Agoralia and App Agoralia repos.
 * This triggers automatic deployments on Vercel/Railway.
 */

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'giacomocavalcabo';

interface GitHubFile {
  path: string;
  content: string;
  message: string;
}

interface GitHubRepo {
  owner: string;
  repo: string;
  branch?: string;
}

/**
 * Get file content from GitHub
 */
export async function getFileFromGitHub(
  repo: GitHubRepo,
  filePath: string
): Promise<{ content: string; sha: string } | null> {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN not configured');
  }

  const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${filePath}`;
  
  try {
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3+json',
      },
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const data = await response.json();
    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    
    return { content, sha: data.sha };
  } catch (error) {
    console.error(`Error fetching file from GitHub: ${filePath}`, error);
    throw error;
  }
}

/**
 * Create or update a file on GitHub
 */
export async function updateFileOnGitHub(
  repo: GitHubRepo,
  file: GitHubFile,
  existingSha?: string
): Promise<{ sha: string; url: string }> {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN not configured');
  }

  const url = `https://api.github.com/repos/${repo.owner}/${repo.repo}/contents/${file.path}`;
  
  const body: Record<string, string> = {
    message: file.message,
    content: Buffer.from(file.content).toString('base64'),
    branch: repo.branch || 'main',
  };

  if (existingSha) {
    body.sha = existingSha;
  }

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`GitHub API error: ${error.message || response.statusText}`);
  }

  const data = await response.json();
  return {
    sha: data.content.sha,
    url: data.content.html_url,
  };
}

/**
 * Sync multiple files to GitHub in a single commit (using tree API)
 */
export async function syncFilesToGitHub(
  repo: GitHubRepo,
  files: GitHubFile[],
  commitMessage: string
): Promise<{ commit_sha: string; files_updated: number }> {
  if (!GITHUB_TOKEN) {
    throw new Error('GITHUB_TOKEN not configured');
  }

  const branch = repo.branch || 'main';
  const baseUrl = `https://api.github.com/repos/${repo.owner}/${repo.repo}`;

  // 1. Get current commit SHA
  const refResponse = await fetch(`${baseUrl}/git/ref/heads/${branch}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  
  if (!refResponse.ok) {
    throw new Error('Failed to get branch reference');
  }
  
  const refData = await refResponse.json();
  const currentCommitSha = refData.object.sha;

  // 2. Get current tree
  const commitResponse = await fetch(`${baseUrl}/git/commits/${currentCommitSha}`, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
    },
  });
  
  if (!commitResponse.ok) {
    throw new Error('Failed to get commit');
  }
  
  const commitData = await commitResponse.json();
  const baseTreeSha = commitData.tree.sha;

  // 3. Create blobs for each file
  const treeItems = await Promise.all(
    files.map(async (file) => {
      const blobResponse = await fetch(`${baseUrl}/git/blobs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: file.content,
          encoding: 'utf-8',
        }),
      });

      if (!blobResponse.ok) {
        throw new Error(`Failed to create blob for ${file.path}`);
      }

      const blobData = await blobResponse.json();
      return {
        path: file.path,
        mode: '100644' as const,
        type: 'blob' as const,
        sha: blobData.sha,
      };
    })
  );

  // 4. Create new tree
  const treeResponse = await fetch(`${baseUrl}/git/trees`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeItems,
    }),
  });

  if (!treeResponse.ok) {
    throw new Error('Failed to create tree');
  }

  const treeData = await treeResponse.json();

  // 5. Create commit
  const newCommitResponse = await fetch(`${baseUrl}/git/commits`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: commitMessage,
      tree: treeData.sha,
      parents: [currentCommitSha],
    }),
  });

  if (!newCommitResponse.ok) {
    throw new Error('Failed to create commit');
  }

  const newCommitData = await newCommitResponse.json();

  // 6. Update reference
  const updateRefResponse = await fetch(`${baseUrl}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      sha: newCommitData.sha,
    }),
  });

  if (!updateRefResponse.ok) {
    throw new Error('Failed to update reference');
  }

  return {
    commit_sha: newCommitData.sha,
    files_updated: files.length,
  };
}

/**
 * Get repo config for known projects
 */
export function getRepoConfig(project: 'sito' | 'app'): GitHubRepo {
  const repos: Record<string, GitHubRepo> = {
    sito: {
      owner: GITHUB_OWNER,
      repo: 'Agoralia-site',
      branch: 'main',
    },
    app: {
      owner: GITHUB_OWNER,
      repo: 'Agoralia',
      branch: 'main',
    },
  };
  
  return repos[project];
}
