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

        // Extract and fetch additional pages - be aggressive
        const linkRegex = /href=["']([^"']+)["']/gi;
        const links: string[] = [];
        let match;
        while ((match = linkRegex.exec(html)) !== null) {
          const href = match[1];
          if (href.startsWith('/') && !href.startsWith('//')) {
            links.push(rootDomain + href);
          } else if (href.startsWith(rootDomain)) {
            links.push(href);
          }
        }

        // Keywords that indicate grant information
        const grantKeywords = ['grant', 'fund', 'apply', 'deadline', 'eligib', 'guideline', 'program', 'award', 'nonprofit', 'application', 'criteria', 'requirement', 'submit', 'proposal', 'letter-of-inquiry', 'loi', 'rfa', 'rfp'];

        // Also try common paths that might not be linked
        const commonPaths = [
          '/grants', '/grants/', '/grantmaking', '/funding', '/apply',
          '/grants/guidelines', '/grants/apply', '/grants/eligibility',
          '/for-grantseekers', '/for-nonprofits', '/programs',
          '/what-we-fund', '/how-to-apply', '/application-process',
          '/about', '/about-us', '/contact', '/contact-us'
        ];

        const foundLinks = [...new Set(links)]
          .filter(link => grantKeywords.some(kw => link.toLowerCase().includes(kw)));

        const allLinksToTry = [...new Set([
          ...foundLinks,
          ...commonPaths.map(p => rootDomain + p)
        ])].slice(0, 10);

        // Fetch additional pages in parallel for speed
        const fetchPromises = allLinksToTry.map(async (link) => {
          if (link === normalizedUrl) return null;
          try {
            const resp = await fetchWithTimeout(link, 4000);
            if (resp.ok) {
              const pageHtml = await resp.text();
              const text = extractText(pageHtml);
              if (text.length > 200) {
                return `=== ${link} ===\n${text.slice(0, 4000)}\n\n`;
              }
            }
          } catch {
            // Skip failed pages
          }
          return null;
        });

        const additionalPages = await Promise.all(fetchPromises);
        additionalPages.forEach(p => { if (p) pageContent += p; });
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
          content: `You are an expert grant researcher. Extract COMPLETE grant information from this foundation website. Search the content THOROUGHLY - the information IS there, you need to find it.

YOUR MISSION: Find ALL the details. Read every section carefully.

1. ORGANIZATION NAME: Find the official foundation/organization name. Look at headers, footers, "About" sections.

2. DEADLINES - SEARCH CAREFULLY:
   - Look for: "deadline", "due date", "submit by", "application period", "cycle", "quarterly", "rolling", "open"
   - Find SPECIFIC dates mentioned (e.g., "February 15", "first Monday of each quarter")
   - If quarterly/rolling, list the ACTUAL dates from the site (not made-up ones)
   - deadlineType: "rolling" (ongoing/multiple cycles), "fixed" (single deadline), "invitation_only"

3. GRANT AMOUNTS - LOOK EVERYWHERE:
   - Search for: "$", "grant size", "award", "funding level", "range", "up to", "between", "maximum", "minimum"
   - Common places: guidelines page, FAQ, "what we fund", eligibility section
   - Even phrases like "typically fund $5,000-$25,000" count

4. LOCATION:
   - Check: footer, contact page, "About Us", address mentions
   - Format: "City, State" (e.g., "Seattle, WA", "New York, NY")

5. ELIGIBILITY - BE THOROUGH:
   - Look for: "eligible", "must be", "requirements", "who can apply", "501(c)(3)", geographic limits
   - Include: tax status, location requirements, budget size limits, years in operation

6. OVERVIEW: Summarize what they fund, who can apply, and any focus areas.

The content below comes from MULTIPLE PAGES of their website. The information IS in there - find it!

Return ONLY JSON:
{
  "organizationName": "Proper Name",
  "budgetMin": number,
  "budgetMax": number,
  "deadline": "YYYY-MM-DD or empty",
  "deadlineType": "fixed" | "rolling" | "invitation_only",
  "rollingDates": "Actual dates from site like 'Mar 1, Jun 1, Sep 1, Dec 1' or quarterly pattern found",
  "deadlineNotes": "Any additional deadline details, LOI requirements, etc.",
  "location": "City, State (from contact/footer/about page)",
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
