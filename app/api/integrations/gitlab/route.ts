import { NextResponse } from 'next/server';
import https from 'https';

function fetchGitlab(urlStr: string, token: string): Promise<{status: number, data: any}> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'PRIVATE-TOKEN': token,
        'Accept': 'application/json'
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

    if (!integration || !integration.base_url || !integration.api_token || !integration.target_project_key) {
      return NextResponse.json({ error: 'Missing GitLab integration details' }, { status: 400 });
    }

    const safeToken = integration.api_token.trim();
    const projectId = encodeURIComponent(integration.target_project_key.trim());
    
    // Step 1: Validate connection by fetching the project details
    const projectUrl = new URL(`/api/v4/projects/${projectId}`, integration.base_url).toString();
    const projectResponse = await fetchGitlab(projectUrl, safeToken);

    if (projectResponse.status !== 200) {
      if (projectResponse.status === 401 || projectResponse.status === 403) {
        throw new Error('Invalid GitLab Credentials: API Token is incorrect or missing permissions.');
      }
      if (projectResponse.status === 404) {
        throw new Error(`GitLab Project ID '${projectId}' not found.`);
      }
      throw new Error(`GitLab check failed: ${projectResponse.status}`);
    }

    // Step 2: Fetch Issues
    const url = new URL(`/api/v4/projects/${projectId}/issues`, integration.base_url);
    url.searchParams.append('state', 'all'); // Fetch both opened and closed
    url.searchParams.append('per_page', '100');
    url.searchParams.append('order_by', 'created_at');
    url.searchParams.append('sort', 'desc');

    const searchResponse = await fetchGitlab(url.toString(), safeToken);
    
    if (searchResponse.status !== 200) {
      throw new Error(`GitLab API returned ${searchResponse.status}: ${JSON.stringify(searchResponse.data)}`);
    }
    
    const gitlabData = searchResponse.data;

    if (!Array.isArray(gitlabData)) {
      throw new Error('Unexpected response format from GitLab API');
    }

    // Map GitLab state to our DefectStatus
    const mapStatus = (state: string) => {
      const s = state.toLowerCase();
      if (s === 'closed') return 'RESOLVED';
      return 'OPEN';
    };

    // GitLab issues don't have severity by default unless labels are used. Defaulting to MEDIUM.
    const mapSeverity = (labels: string[]) => {
      if (!labels) return 'MEDIUM';
      const lowercaseLabels = labels.map(l => l.toLowerCase());
      if (lowercaseLabels.some(l => l.includes('critical') || l.includes('p1'))) return 'CRITICAL';
      if (lowercaseLabels.some(l => l.includes('high') || l.includes('p2'))) return 'HIGH';
      if (lowercaseLabels.some(l => l.includes('low') || l.includes('p4'))) return 'LOW';
      return 'MEDIUM';
    };

    const issues = gitlabData.map((issue: any) => ({
      key: issue.iid.toString(),
      title: issue.title,
      status: mapStatus(issue.state),
      severity: mapSeverity(issue.labels),
      assigneeName: issue.assignee?.name || null,
      reporterName: issue.author?.name || 'GitLab User',
      created_at: issue.created_at,
      url: issue.web_url,
    }));

    return NextResponse.json({ issues });

  } catch (error: any) {
    console.error('GitLab Integration Error:', error);
    return NextResponse.json({ error: error.message || 'Failed to fetch from GitLab' }, { status: 500 });
  }
}
