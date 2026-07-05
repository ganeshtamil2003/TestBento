import { NextResponse } from 'next/server';
import https from 'https';

function fetchJira(urlStr: string, authString: string): Promise<{status: number, data: any}> {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      family: 4, // Force IPv4 to bypass Node 18 fetch IPv6 bug
      headers: {
        'Authorization': `Basic ${authString}`,
        'Accept': 'application/json'
      },
      timeout: 10000
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
    const { integration, issueKeys } = await req.json();

    if (!integration || !integration.base_url || !integration.email || !integration.api_token) {
      return NextResponse.json({ error: 'Missing JIRA integration details' }, { status: 400 });
    }

    const hasKeys = issueKeys && Array.isArray(issueKeys) && issueKeys.length > 0;

    // Prepare Basic Auth (trim whitespace/newlines from copied tokens)
    const safeEmail = integration.email.trim();
    const safeToken = integration.api_token.trim();
    const authString = Buffer.from(`${safeEmail}:${safeToken}`).toString('base64');
    
    // Build JQL
    let jql = '';
    if (hasKeys) {
      jql = `issueKey IN (${issueKeys.map(k => `"${k}"`).join(',')})`;
    } else {
      if (!integration.target_project_key) {
         return NextResponse.json({ issues: [] });
      }
      jql = `project = "${integration.target_project_key}" AND issuetype = Bug ORDER BY created DESC`;
    }

    // Step 1: Validate credentials with /myself endpoint
    const myselfUrl = new URL('/rest/api/3/myself', integration.base_url).toString();
    const authResponse = await fetchJira(myselfUrl, authString);

    if (authResponse.status !== 200) {
      if (authResponse.status === 401 || authResponse.status === 403) {
        throw new Error('Invalid Jira Credentials: Email or API Token is incorrect.');
      }
      throw new Error(`Jira Auth Check failed: ${authResponse.status}`);
    }

    // Step 2: Fetch Issues
    const url = new URL('/rest/api/3/search/jql', integration.base_url);
    url.searchParams.append('jql', jql);
    url.searchParams.append('fields', 'status,assignee,priority,summary,created,reporter');
    url.searchParams.append('maxResults', '100');

    const searchResponse = await fetchJira(url.toString(), authString);
    
    if (searchResponse.status !== 200) {
      throw new Error(`JIRA API returned ${searchResponse.status}: ${JSON.stringify(searchResponse.data)}`);
    }
    
    const jiraData = searchResponse.data;

    // Map JIRA status to our DefectStatus
    const mapStatus = (jiraStatus: string) => {
      const s = jiraStatus.toLowerCase();
      if (s.includes('done') || s.includes('resolved') || s.includes('closed')) return 'RESOLVED';
      if (s.includes('progress') || s.includes('active')) return 'IN_PROGRESS';
      return 'OPEN';
    };

    const mapSeverity = (jiraPriority: string) => {
      const p = jiraPriority.toLowerCase();
      if (p.includes('highest') || p.includes('critical')) return 'CRITICAL';
      if (p.includes('high')) return 'HIGH';
      if (p.includes('low') || p.includes('lowest')) return 'LOW';
      return 'MEDIUM';
    };

    const formattedIssues = jiraData.issues.map((issue: any) => ({
      key: issue.key,
      title: issue.fields.summary,
      status: mapStatus(issue.fields.status?.name || 'Open'),
      severity: mapSeverity(issue.fields.priority?.name || 'Medium'),
      assigneeName: issue.fields.assignee?.displayName || 'Unassigned',
      rawStatus: issue.fields.status?.name || 'Open',
      created_at: issue.fields.created,
      reporterName: issue.fields.reporter?.displayName || 'Unknown',
    }));

    return NextResponse.json({ issues: formattedIssues });
  } catch (error: any) {
    console.error("Error in JIRA integration route:", error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
