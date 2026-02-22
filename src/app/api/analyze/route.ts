import { NextRequest, NextResponse } from 'next/server';
import { Grant } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Normalize URL
    let normalizedUrl = url;
    if (url.startsWith('http://')) {
      normalizedUrl = url.replace('http://', 'https://');
    }

    const fetchWithTimeout = async (fetchUrl: string, timeout = 12000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const response = await fetch(fetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          },
          redirect: 'follow',
          signal: controller.signal,
        });
        clearTimeout(timeoutId);
        return response;
      } catch (err) {
        clearTimeout(timeoutId);
        throw err;
      }
    };

    const extractText = (html: string): string => {
      return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    const getRootDomain = (inputUrl: string): string => {
      try {
        const urlObj = new URL(inputUrl);
        return `${urlObj.protocol}//${urlObj.hostname}`;
      } catch {
        return inputUrl;
      }
    };

    let pageContent = '';
    let actualUrlUsed = normalizedUrl;

    try {
      // Fetch main page
      const response = await fetchWithTimeout(normalizedUrl);

      if (!response.ok) {
        // Try root domain
        const rootDomain = getRootDomain(normalizedUrl);
        if (normalizedUrl !== rootDomain) {
          const rootResponse = await fetchWithTimeout(rootDomain);
          if (rootResponse.ok) {
            const html = await rootResponse.text();
            pageContent = `=== ${rootDomain} ===\n${extractText(html).slice(0, 8000)}`;
            actualUrlUsed = rootDomain;
          }
        }
      } else {
        const html = await response.text();
        const rootDomain = getRootDomain(normalizedUrl);
        pageContent = `=== ${normalizedUrl} ===\n${extractText(html).slice(0, 8000)}\n\n`;

        // Extract and fetch additional pages
        const linkRegex = /href=["']([^"']+)["']/gi;
        const links: string[] = [];
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
          const href = match[1];
          if (href.startsWith('/') && !href.startsWith('//')) {
            links.push(rootDomain + href);
          }
        }

        const grantKeywords = ['grant', 'fund', 'apply', 'deadline', 'eligib', 'guideline'];
        const grantLinks = [...new Set(links)]
          .filter(link => grantKeywords.some(kw => link.toLowerCase().includes(kw)))
          .slice(0, 4);

        // Fetch additional pages
        for (const link of grantLinks) {
          try {
            const resp = await fetchWithTimeout(link, 5000);
            if (resp.ok) {
              const pageHtml = await resp.text();
              pageContent += `=== ${link} ===\n${extractText(pageHtml).slice(0, 3000)}\n\n`;
            }
          } catch {
            // Skip failed pages
          }
        }
      }

      if (!pageContent) {
        return NextResponse.json({
          grant: generateBasicGrant(url, 'Could not fetch website'),
          debug: 'fetch_failed'
        });
      }

    } catch (err) {
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      return NextResponse.json({
        grant: generateBasicGrant(url, errMsg.includes('abort') ? 'Timeout' : errMsg),
        debug: 'fetch_error'
      });
    }

    // Check API key
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json({
        grant: generateBasicGrant(url, 'No API key'),
        debug: 'no_api_key'
      });
    }

    // Call Claude
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: `Extract grant information from this foundation website. BE ACCURATE - only use info you find.

RULES:
1. ORGANIZATION NAME: Exact name with proper spacing (e.g., "The Seattle Foundation")
2. DEADLINES:
   - Find ALL dates mentioned. For rolling/quarterly, list all (e.g., "Jan 31, Apr 30, Jul 31, Oct 31")
   - Use 2025/2026 dates only. Convert past years to next occurrence.
   - deadlineType: "rolling" (multiple per year), "fixed" (one deadline), "invitation_only"
3. LOCATION: Find actual city/state from contact info or footer
4. AMOUNTS: Find specific dollar ranges mentioned
5. ELIGIBILITY: List all requirements found (501c3, geographic, budget size, etc.)
6. IF NOT FOUND: Use "" or 0. Don't guess.

Return ONLY JSON:
{
  "organizationName": "Proper Name",
  "budgetMin": number,
  "budgetMax": number,
  "deadline": "YYYY-MM-DD or empty",
  "deadlineType": "fixed" | "rolling" | "invitation_only",
  "rollingDates": "Jan 31, Apr 30, Jul 31, Oct 31",
  "deadlineNotes": "extra info",
  "location": "City, State",
  "artsDiscipline": "Classical Music" | "General Arts" | "Performing Arts" | "Music Education" | "Humanities",
  "fundingType": "General Operating" | "Project-Based" | "Capital" | "Fellowship" | "Commissioning",
  "funderType": "Government" | "Private Foundation" | "Corporate" | "Community Foundation" | "Service Organization",
  "eligibility": "requirements",
  "overview": "2-3 sentence summary"
}

URL: ${actualUrlUsed}

CONTENT:
${pageContent.slice(0, 20000)}`
        }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      console.error('Claude error:', errText);
      return NextResponse.json({
        grant: generateBasicGrant(url, 'AI error'),
        debug: 'claude_failed',
        error: errText
      });
    }

    const data = await claudeResponse.json();
    const text = data.content[0]?.text || '';

    let grantData;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        grantData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON');
      }
    } catch {
      return NextResponse.json({
        grant: generateBasicGrant(url, 'Parse error'),
        debug: 'parse_failed'
      });
    }

    const grant: Grant = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      organizationName: grantData.organizationName || 'Unknown',
      website: actualUrlUsed,
      budgetMin: grantData.budgetMin || 0,
      budgetMax: grantData.budgetMax || 0,
      deadline: grantData.deadline || '',
      deadlineType: grantData.deadlineType,
      rollingDates: grantData.rollingDates || '',
      deadlineNotes: grantData.deadlineNotes || '',
      location: grantData.location || '',
      artsDiscipline: grantData.artsDiscipline || 'General Arts',
      fundingType: grantData.fundingType || 'Project-Based',
      funderType: grantData.funderType || 'Private Foundation',
      eligibility: grantData.eligibility || '',
      overview: grantData.overview || '',
      applicationUrl: actualUrlUsed,
      isInvitationOnly: grantData.deadlineType === 'invitation_only',
    };

    return NextResponse.json({ grant, debug: 'success' });

  } catch (error) {
    console.error('Error:', error);
    return NextResponse.json({ error: 'Failed to analyze' }, { status: 500 });
  }
}

function generateBasicGrant(url: string, error: string): Grant {
  let name = 'Unknown';
  try {
    name = new URL(url).hostname.replace('www.', '').split('.')[0]
      .split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  } catch {}

  return {
    id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    organizationName: name,
    website: url,
    budgetMin: 0,
    budgetMax: 0,
    deadline: '',
    deadlineNotes: `Error: ${error}`,
    location: '',
    artsDiscipline: 'General Arts',
    fundingType: 'Project-Based',
    funderType: 'Private Foundation',
    eligibility: '',
    overview: `Could not analyze: ${error}. Visit ${url} directly.`,
    applicationUrl: url,
  };
}
