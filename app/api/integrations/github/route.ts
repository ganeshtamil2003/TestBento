import { NextResponse } from 'next/server';
import https from 'https';

function fetchGithub(urlStr: string, token: string): Promise<{status: number, data: any}> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'TestBento-Integration', // GitHub requires User-Agent
        'X-GitHub-Api-Version': '2022-11-28'
      },
      timeout: 30000
    };

    const req = https.request(options, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          const data = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode || 200, data });
        } catch (e) {
          resolve({ status: res.statusCode || 200, data: { errorText: body } });
        }
      });
    });

    req.on('error', e => reject(e));
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    req.end();
  });
}

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const { integration } = await req.json();

    if (!integration || !integration.api_token || !integration.target_project_key) {
      return NextResponse.json({ error: 'Missing GitHub integration details' }, { status: 400 });
    }

    const safeToken = integration.api_token.trim();
    // target_project_key for github is "owner/repo"
    const repo = integration.target_project_key.trim();
    
    // GitHub API base url is mostly api.github.com unless enterprise
    const baseUrl = integration.base_url && integration.base_url !== '' 
        ? integration.base_url 
        : 'https://api.github.com';

    // Step 1: Validate connection by fetching the repository details
    const repoUrl = new URL(`/repos/${repo}`, baseUrl).toString();
    const repoResponse = await fetchGithub(repoUrl, safeToken);

    if (repoResponse.status !== 200) {
      if (repoResponse.status === 401 || repoResponse.status === 403) {
        throw new Error('Invalid GitHub Credentials: API Token is incorrect or missing permissions.');
      }
      if (repoResponse.status === 404) {
        throw new Error(`GitHub Repository '${repo}' not found. Make sure it is formatted as 'owner/repo'.`);
      }
      throw new Error(`GitHub check failed: ${repoResponse.status}`);
    }

    // Step 2: Fetch Issues
    const url = new URL(`/repos/${repo}/issues`, baseUrl);
    url.searchParams.append('state', 'all'); // Fetch both opened and closed
    url.searchParams.append('per_page', '100');
    url.searchParams.append('sort', 'created');
    url.searchParams.append('direction', 'desc');

    const searchResponse = await fetchGithub(url.toString(), safeToken);
    
    if (searchResponse.status !== 200) {
      throw new Error(`GitHub API returned ${searchResponse.status}: ${JSON.stringify(searchResponse.data)}`);
    }
    
    const githubData = searchResponse.data;

    if (!Array.isArray(githubData)) {
      throw new Error('Unexpected response format from GitHub API');
    }

    // Map GitHub state to our DefectStatus
    const mapStatus = (state: string) => {
      const s = state.toLowerCase();
      if (s === 'closed') return 'RESOLVED';
      return 'OPEN';
    };

    // GitHub issues don't have severity by default. Defaulting to MEDIUM.
    const mapSeverity = (labels: any[]) => {
      if (!labels || !Array.isArray(labels)) return 'MEDIUM';
      const lowercaseLabels = labels.map(l => (typeof l === 'string' ? l : l.name).toLowerCase());
      if (lowercaseLabels.some(l => l.includes('critical') || l.includes('p1') || l.includes('bug'))) return 'HIGH'; // We can map "bug" to HIGH
      if (lowercaseLabels.some(l => l.includes('high') || l.includes('p2'))) return 'HIGH';
      if (lowercaseLabels.some(l => l.includes('low') || l.includes('p4'))) return 'LOW';
      return 'MEDIUM';
    };

    // Filter out pull requests (GitHub treats PRs as issues in the REST API)
    const issuesOnly = githubData.filter(issue => !issue.pull_request);

    const issues = issuesOnly.map((issue: any) => ({
      key: issue.number.toString(),
      title: issue.title,
      status: mapStatus(issue.state),
      severity: mapSeverity(issue.labels),
      assigneeName: issue.assignee?.login || null,
      reporterName: issue.user?.login || 'GitHub User',
      created_at: issue.created_at,
      url: issue.html_url,
    }));

    return NextResponse.json({ issues });

  } catch (error: any) {
    console.error('GitHub Integration Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch from GitHub' }, { status: 500 });
  }
}
