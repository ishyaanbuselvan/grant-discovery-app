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

    const fetchWithTimeout = async (fetchUrl: string, timeout = 20000, retries = 3) => {
      const userAgents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
      ];

      for (let attempt = 0; attempt <= retries; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        try {
          const response = await fetch(fetchUrl, {
            headers: {
              'User-Agent': userAgents[attempt % userAgents.length],
              'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
              'Accept-Language': 'en-US,en;q=0.9',
              'Accept-Encoding': 'gzip, deflate, br',
              'Connection': 'keep-alive',
              'Upgrade-Insecure-Requests': '1',
            },
            redirect: 'follow',
            signal: controller.signal,
          });
          clearTimeout(timeoutId);
          if (response.ok) return response;
        } catch (err) {
          clearTimeout(timeoutId);
          if (attempt === retries) throw err;
          await new Promise(r => setTimeout(r, 300 * (attempt + 1)));
        }
      }
      throw new Error('All retries failed');
    };

    // Try multiple URL variations
    const tryMultipleUrls = async (baseUrl: string): Promise<{ response: Response; url: string } | null> => {
      const urlVariations = [
        baseUrl,
        baseUrl.replace('https://', 'https://www.'),
        baseUrl.replace('https://www.', 'https://'),
        baseUrl.replace('https://', 'http://'),
      ].filter((v, i, a) => a.indexOf(v) === i); // Remove duplicates

      for (const url of urlVariations) {
        try {
          const response = await fetchWithTimeout(url, 15000, 1);
          if (response.ok) return { response, url };
        } catch {
          // Try next variation
        }
      }
      return null;
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
      // Fetch main page - try multiple URL variations
      let result = await tryMultipleUrls(normalizedUrl);

      if (!result) {
        // Try root domain and common paths
        const rootDomain = getRootDomain(normalizedUrl);
        const fallbackUrls = [
          rootDomain,
          rootDomain + '/grants',
          rootDomain + '/grantmaking',
          rootDomain + '/funding',
          rootDomain + '/programs',
          rootDomain + '/for-grantseekers',
        ];

        for (const fallbackUrl of fallbackUrls) {
          result = await tryMultipleUrls(fallbackUrl);
          if (result) {
            actualUrlUsed = result.url;
            break;
          }
        }
      }

      if (!result) {
        return NextResponse.json({
          grant: generateBasicGrant(url, 'Could not connect to website after multiple attempts'),
          debug: 'all_fetches_failed'
        });
      }

      const response = result.response;
      actualUrlUsed = result.url;

      if (response.ok) {
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
    const currentYear = new Date().getFullYear();
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-haiku-20240307',
        max_tokens: 2500,
        messages: [{
          role: 'user',
          content: `You are extracting grant information from a foundation website. Today's year is ${currentYear}. BE THOROUGH - look at ALL sections of the content provided.

CRITICAL EXTRACTION RULES:

1. BUDGETS - Search AGGRESSIVELY for dollar amounts (THIS IS CRITICAL):
   - Look for: "$", "dollars", "up to", "grants range", "awards of", "funding up to", "maximum", "minimum", "average grant", "grant size", "award amounts", "typical grant", "grant awards", "funding range"
   - Check EVERY section: guidelines, FAQ, "how to apply", annual reports, grant lists, past grantees, 990 info
   - Patterns: "$5,000-$50,000", "up to $25,000", "typically range from", "awards average", "grants of $X", "awarded $X to", "received $X"
   - If you see past grantee info like "awarded $15,000 to XYZ Org" - USE THAT as a reference
   - If you find ANY dollar amount related to grants, USE IT - don't skip it
   - If only max found, min = 10% of max. If only one number, use it for both.
   - Look for phrases like "grants range from X to Y", "up to $X", "minimum of $X"
   - DO NOT return 0 unless you searched thoroughly and found NOTHING about money

2. DEADLINES - Find SPECIFIC dates, not generic terms:
   - Search for: "deadline", "due date", "submit by", "applications accepted", "cycle dates", "quarterly deadlines", "next deadline", "application period"
   - IMPORTANT: If they say "quarterly" or "rolling" - look for the ACTUAL DATES (e.g., "Feb 1, May 1, Aug 1, Nov 1")
   - Look in: application guidelines, "how to apply", grant cycles, calendar sections
   - If you find "last Monday in March" or similar, put that EXACT wording in deadlineNotes
   - ANY date from before ${currentYear} should be updated to ${currentYear} or ${currentYear + 1}
   - deadlineType options:
     * "fixed" = single annual deadline
     * "rolling" = multiple deadlines per year OR accepts anytime
     * "invitation_only" = NO open applications, by invitation only

3. INVITATION-ONLY CHECK:
   - Look for: "by invitation only", "does not accept unsolicited proposals", "invitation-based", "rarely accepts unsolicited"
   - If found, set deadlineType to "invitation_only" and note this prominently in eligibility and deadlineNotes

4. ELIGIBILITY REQUIREMENTS - Note EVERYTHING:
   - Look for: eligibility quizzes, pre-application requirements, geographic restrictions
   - If they have an "eligibility quiz" or "determine your eligibility" - MENTION THIS
   - Note: 501(c)(3) requirements, geographic focus, budget size limits, years of operation

5. LOCATION - Organization headquarters:
   - Look in: footer, contact page, about page, address
   - Format as "City, State" (e.g., "Seattle, WA")

6. ORGANIZATION NAME - Official name with proper capitalization

7. CONTACT EMAIL - Find grants-related email:
   - Look for: "grants@", "info@", "apply@", "applications@", "contact us", email in footer
   - Prefer grants-specific emails over general info emails
   - Format: just the email address (e.g., "grants@foundation.org")

8. OVERVIEW - Include:
   - What they fund (arts disciplines, project types)
   - Any special focus areas
   - Approximate % of funding for arts if mentioned

Return ONLY this JSON (no other text):
{
  "organizationName": "string",
  "budgetMin": number,
  "budgetMax": number,
  "deadline": "YYYY-MM-DD or empty string",
  "deadlineType": "fixed" | "rolling" | "invitation_only",
  "rollingDates": "ACTUAL dates like 'Feb 1, May 1, Aug 1, Nov 1' or 'Last Monday in March' - NOT just 'Quarterly'",
  "deadlineNotes": "Include specific cycle info, eligibility quiz requirements, invitation-only status",
  "location": "City, State",
  "contactEmail": "grants@example.org or empty string",
  "artsDiscipline": "Classical Music" | "General Arts" | "Performing Arts" | "Music Education" | "Humanities",
  "fundingType": "General Operating" | "Project-Based" | "Capital" | "Fellowship" | "Commissioning",
  "funderType": "Government" | "Private Foundation" | "Corporate" | "Community Foundation" | "Service Organization",
  "eligibility": "Include any eligibility quiz requirements, geographic restrictions, invitation-only status",
  "overview": "string"
}

URL: ${actualUrlUsed}

WEBSITE CONTENT (search ALL of this carefully):
${pageContent.slice(0, 22000)}`
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

    // Fix and normalize budgets
    let budgetMin = grantData.budgetMin || 0;
    let budgetMax = grantData.budgetMax || 0;

    // Fix backwards budgets
    if (budgetMin > budgetMax && budgetMax > 0) {
      [budgetMin, budgetMax] = [budgetMax, budgetMin];
    }

    // If only one value, estimate the other
    if (budgetMin > 0 && budgetMax === 0) {
      budgetMax = budgetMin * 2;
    }
    if (budgetMax > 0 && budgetMin === 0) {
      budgetMin = Math.round(budgetMax * 0.1);
    }

    // If still 0/0, use reasonable estimate based on funder type
    // Better to show estimate than nothing - user can verify on website
    if (budgetMin === 0 && budgetMax === 0) {
      const funderType = grantData.funderType || 'Private Foundation';
      if (funderType === 'Government') {
        budgetMin = 5000;
        budgetMax = 75000;
      } else if (funderType === 'Corporate') {
        budgetMin = 2500;
        budgetMax = 25000;
      } else if (funderType === 'Community Foundation') {
        budgetMin = 1000;
        budgetMax = 15000;
      } else if (funderType === 'Service Organization') {
        budgetMin = 1000;
        budgetMax = 20000;
      } else {
        // Private Foundation default
        budgetMin = 5000;
        budgetMax = 50000;
      }
    }

    // Cap unreasonable values
    if (budgetMax > 10000000) {
      budgetMax = 500000;
    }
    if (budgetMin > 1000000) {
      budgetMin = 10000;
    }

    // Fix old dates - update any date before current year to current/next year
    let deadline = grantData.deadline || '';
    if (deadline) {
      const deadlineDate = new Date(deadline);
      const currentYear = new Date().getFullYear();
      if (deadlineDate.getFullYear() < currentYear) {
        // Update to current year, or next year if that date has passed
        const updatedDate = new Date(deadlineDate);
        updatedDate.setFullYear(currentYear);
        if (updatedDate < new Date()) {
          updatedDate.setFullYear(currentYear + 1);
        }
        deadline = updatedDate.toISOString().split('T')[0];
      }
    }

    // Clean up location - remove "See Website" type values
    let location = grantData.location || '';
    if (location.toLowerCase().includes('see website') ||
        location.toLowerCase().includes('not found') ||
        location.toLowerCase().includes('unknown') ||
        location.length < 3) {
      location = '';
    }

    const grant: Grant = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      organizationName: grantData.organizationName || 'Unknown',
      website: actualUrlUsed,
      budgetMin,
      budgetMax,
      deadline,
      deadlineType: grantData.deadlineType,
      rollingDates: grantData.rollingDates || '',
      deadlineNotes: grantData.deadlineNotes || '',
      location,
      contactEmail: grantData.contactEmail || '',
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
