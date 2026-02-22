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
          content: `Extract grant information from this foundation's website.

1. ORGANIZATION NAME: Official name with proper capitalization

2. DEADLINES:
   - Search the content for SPECIFIC dates mentioned by THIS foundation
   - Look for exact dates like "February 1", "March 15", "first Monday of April"
   - If they say "quarterly" - find THEIR specific quarterly dates, not generic ones
   - rollingDates should contain the ACTUAL dates from the site, like "Feb 1, May 1, Aug 1, Nov 1"
   - If no specific dates found, put "Quarterly" or "Monthly" or "Rolling" - do NOT invent specific dates
   - deadlineType: "rolling", "fixed", or "invitation_only"

3. GRANT AMOUNTS:
   - Search thoroughly for dollar amounts: "$5,000", "$50,000", "up to $25K"
   - Look in: guidelines, FAQ, eligibility, "what we fund", program descriptions
   - Use ANY amount found: "grants up to $10,000" = budgetMax: 10000
   - If only one amount found, use for both min and max
   - Only use 0 if you truly searched everywhere and found nothing

4. LOCATION: City, State from contact/footer/about

5. ELIGIBILITY: 501(c)(3), geographic limits, budget requirements

6. OVERVIEW: 2-3 sentences on what they fund

Return ONLY valid JSON:
{
  "organizationName": "Proper Name",
  "budgetMin": number,
  "budgetMax": number,
  "deadline": "YYYY-MM-DD or empty",
  "deadlineType": "fixed" | "rolling" | "invitation_only",
  "rollingDates": "ACTUAL dates from THIS site like 'Feb 1, May 1, Aug 1, Nov 1' OR just 'Quarterly'/'Rolling' if no dates",
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

    // Fix backwards budgets
    let budgetMin = grantData.budgetMin || 0;
    let budgetMax = grantData.budgetMax || 0;
    if (budgetMin > budgetMax && budgetMax > 0) {
      [budgetMin, budgetMax] = [budgetMax, budgetMin];
    }
    if (budgetMin > 0 && budgetMax === 0) {
      budgetMax = budgetMin;
    }

    const grant: Grant = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      organizationName: grantData.organizationName || 'Unknown',
      website: actualUrlUsed,
      budgetMin,
      budgetMax,
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
