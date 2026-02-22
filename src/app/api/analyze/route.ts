import { NextRequest, NextResponse } from 'next/server';
import { Grant } from '@/lib/types';

export async function POST(request: NextRequest) {
  try {
    const { url } = await request.json();

    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    // Normalize URL (ensure https)
    let normalizedUrl = url;
    if (url.startsWith('http://')) {
      normalizedUrl = url.replace('http://', 'https://');
    }

    // Fetch the webpage content with better error handling
    let pageContent = '';
    let fetchError: string | null = null;

    const fetchWithTimeout = async (fetchUrl: string, timeout = 15000) => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(fetchUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.5',
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

    // Extract root domain from URL
    const getRootDomain = (inputUrl: string): string => {
      try {
        const urlObj = new URL(inputUrl);
        return `${urlObj.protocol}//${urlObj.hostname}`;
      } catch {
        return inputUrl;
      }
    };

    // Common grant-related paths to try if root domain works
    const grantPaths = ['/grants', '/funding', '/programs', '/apply', '/grantmaking', '/for-nonprofits'];

    // Additional pages to crawl for more info
    const additionalPaths = [
      '/grants',
      '/grants/guidelines',
      '/grants/deadlines',
      '/grants/eligibility',
      '/grants/apply',
      '/grants/overview',
      '/grants/faq',
      '/grantmaking',
      '/grantmaking/guidelines',
      '/how-to-apply',
      '/application-process',
      '/funding',
      '/funding/apply',
      '/funding/guidelines',
      '/programs',
      '/programs/grants',
      '/programs/arts',
      '/for-nonprofits',
      '/for-grantseekers',
      '/apply',
      '/eligibility',
      '/about',
      '/about-us',
      '/contact',
      '/contact-us',
    ];

    // Extract text content from HTML
    const extractText = (html: string): string => {
      return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
    };

    // Extract links from HTML
    const extractLinks = (html: string, baseUrl: string): string[] => {
      const linkRegex = /href=["']([^"']+)["']/gi;
      const links: string[] = [];
      let match;
      while ((match = linkRegex.exec(html)) !== null) {
        const href = match[1];
        if (href.startsWith('/') && !href.startsWith('//')) {
          links.push(baseUrl + href);
        } else if (href.startsWith(baseUrl)) {
          links.push(href);
        }
      }
      return [...new Set(links)]; // Remove duplicates
    };

    // Filter for grant-related links
    const filterGrantLinks = (links: string[]): string[] => {
      const grantKeywords = ['grant', 'fund', 'apply', 'deadline', 'eligib', 'program', 'guideline', 'application'];
      return links.filter(link => {
        const lowerLink = link.toLowerCase();
        return grantKeywords.some(keyword => lowerLink.includes(keyword));
      }).slice(0, 15); // Get more grant-related pages
    };

    let actualUrlUsed = normalizedUrl;
    let urlNote = '';

    try {
      // Try the original URL first
      let response = await fetchWithTimeout(normalizedUrl);

      // If original URL fails, try smart fallbacks
      if (!response.ok) {
        const rootDomain = getRootDomain(normalizedUrl);

        // Only try fallbacks if we're not already at root
        if (normalizedUrl !== rootDomain && normalizedUrl !== rootDomain + '/') {
          console.log(`Original URL failed (${response.status}), trying root domain: ${rootDomain}`);

          // Try root domain first
          try {
            const rootResponse = await fetchWithTimeout(rootDomain);
            if (rootResponse.ok) {
              response = rootResponse;
              actualUrlUsed = rootDomain;
              urlNote = `Note: Original URL returned ${response.status}, analyzed homepage instead.`;
            } else {
              // Try common grant paths
              for (const path of grantPaths) {
                try {
                  const pathUrl = rootDomain + path;
                  const pathResponse = await fetchWithTimeout(pathUrl, 8000);
                  if (pathResponse.ok) {
                    response = pathResponse;
                    actualUrlUsed = pathUrl;
                    urlNote = `Note: Original URL unavailable, found grant info at ${path}`;
                    break;
                  }
                } catch {
                  // Continue to next path
                }
              }
            }
          } catch {
            // Root domain also failed, stick with original error
          }
        }
      }

      // If HTTPS fails with certain errors, try original HTTP URL
      if (!response.ok && url.startsWith('http://')) {
        try {
          response = await fetchWithTimeout(url);
          if (response.ok) {
            actualUrlUsed = url;
          }
        } catch {
          // Stick with original error
        }
      }

      if (!response.ok) {
        fetchError = `Website returned status ${response.status}`;
        // Still try to extract what we can from the URL
        pageContent = '';
      } else {
        const html = await response.text();
        const rootDomain = getRootDomain(actualUrlUsed);

        // Extract main page content
        let allContent = `=== MAIN PAGE: ${actualUrlUsed} ===\n${extractText(html)}\n\n`;

        // Find grant-related links on the main page
        const pageLinks = extractLinks(html, rootDomain);
        const grantLinks = filterGrantLinks(pageLinks);

        // Prioritize ACTUAL links found on the page, then try common paths as backup
        const pathsToTry = [...new Set([
          ...grantLinks,  // Real links found on the page come first
          ...additionalPaths.map(p => rootDomain + p)  // Common paths as backup
        ])].slice(0, 20); // Crawl up to 20 additional pages

        // Fetch additional pages in parallel
        const additionalFetches = pathsToTry.map(async (pageUrl) => {
          if (pageUrl === actualUrlUsed) return null;
          try {
            const resp = await fetchWithTimeout(pageUrl, 5000);
            if (resp.ok) {
              const pageHtml = await resp.text();
              return `=== PAGE: ${pageUrl} ===\n${extractText(pageHtml).slice(0, 3000)}\n\n`;
            }
          } catch {
            // Ignore errors for additional pages
          }
          return null;
        });

        const additionalContents = await Promise.all(additionalFetches);
        additionalContents.forEach(content => {
          if (content) allContent += content;
        });

        // Limit total content for API
        pageContent = allContent.slice(0, 25000);
        console.log(`Crawled ${1 + additionalContents.filter(Boolean).length} pages`);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';

      // Try root domain as last resort for network errors
      const rootDomain = getRootDomain(normalizedUrl);
      if (normalizedUrl !== rootDomain) {
        try {
          const rootResponse = await fetchWithTimeout(rootDomain);
          if (rootResponse.ok) {
            const html = await rootResponse.text();
            pageContent = html
              .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
              .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
              .replace(/<[^>]+>/g, ' ')
              .replace(/\s+/g, ' ')
              .trim()
              .slice(0, 15000);
            actualUrlUsed = rootDomain;
            urlNote = 'Note: Specific page unavailable, analyzed homepage instead.';
          }
        } catch {
          // Root also failed
        }
      }

      if (!pageContent) {
        if (errorMessage.includes('abort')) {
          fetchError = 'Website took too long to respond (timeout)';
        } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
          fetchError = 'Website not found - domain does not exist';
        } else if (errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
          fetchError = 'Website has SSL/security issues';
        } else {
          fetchError = `Could not reach website: ${errorMessage}`;
        }
        console.error('Fetch error:', err);
      }
    }

    // If we couldn't get content and there's no API key, return basic info from URL
    if (!pageContent && fetchError) {
      const basicGrant = generateBasicGrantFromUrl(url, fetchError);
      return NextResponse.json({ grant: basicGrant });
    }

    // Check if Claude API key is available
    const apiKey = process.env.ANTHROPIC_API_KEY;

    console.log('API Key exists:', !!apiKey);
    console.log('API Key length:', apiKey?.length || 0);

    if (!apiKey) {
      // Return mock data for demo purposes when no API key
      console.log('NO API KEY - using mock data');
      const mockGrant = generateMockGrant(actualUrlUsed, pageContent, urlNote);
      return NextResponse.json({ grant: mockGrant, debug: 'no_api_key' });
    }

    // Call Claude API to analyze the content
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
        messages: [
          {
            role: 'user',
            content: `Extract grant information from this foundation website. BE EXTREMELY ACCURATE.

CRITICAL INSTRUCTIONS:

1. ORGANIZATION NAME: Use the EXACT official name with proper spacing and capitalization (e.g., "The Seattle Foundation" not "Theseattlefoundation" or "SEATTLE FOUNDATION")

2. DEADLINES - THIS IS CRITICAL:
   - Look carefully for ALL deadline dates mentioned (application deadlines, LOI deadlines, quarterly dates)
   - For ROLLING deadlines: List ALL upcoming dates (e.g., "Jan 30, Apr 30, Jul 30, Oct 30")
   - For FIXED deadlines: Use the next upcoming date in 2025 or 2026
   - NEVER use dates from 2022, 2023, or 2024 - those are PAST
   - If dates repeat quarterly/annually, extrapolate to 2025/2026
   - deadlineType: Use "rolling" if multiple dates per year, "fixed" if one deadline, "invitation_only" if by invitation

3. LOCATION: Find the foundation's ACTUAL headquarters address. Look for "Contact Us", footer, or "About" sections. Extract City, State (e.g., "Seattle, WA"). NEVER say "See Website".

4. GRANT AMOUNTS: Find SPECIFIC dollar amounts. Look for "grant range", "award amounts", "funding levels".

5. ELIGIBILITY: Find SPECIFIC requirements - 501(c)(3) status, geographic limits, budget size, years operating, etc.

Return ONLY valid JSON (no markdown, no code blocks):

{
  "organizationName": "Properly Formatted Organization Name",
  "budgetMin": number,
  "budgetMax": number,
  "deadline": "YYYY-MM-DD of NEXT upcoming deadline",
  "deadlineType": "fixed" | "rolling" | "invitation_only",
  "rollingDates": "For rolling: list all dates like 'Jan 30, Apr 30, Jul 30, Oct 30'",
  "deadlineNotes": "Any additional deadline info",
  "location": "City, State",
  "artsDiscipline": "Classical Music" | "General Arts" | "Humanities" | "Performing Arts" | "Music Education",
  "fundingType": "General Operating" | "Project-Based" | "Capital" | "Fellowship" | "Commissioning",
  "funderType": "Government" | "Private Foundation" | "Corporate" | "Community Foundation" | "Service Organization",
  "eligibility": "Specific requirements found on site",
  "overview": "2-3 sentence summary of what this grant funds and who it's for"
}

Webpage URL: ${actualUrlUsed}
Original URL submitted: ${url}
Webpage Content:
${pageContent}`
          }
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', errorText);
      // Fallback to mock data
      const mockGrant = generateMockGrant(url, pageContent);
      return NextResponse.json({ grant: mockGrant, debug: 'claude_api_failed', error: errorText });
    }

    const claudeData = await claudeResponse.json();
    const analysisText = claudeData.content[0]?.text || '';

    // Parse the JSON from Claude's response
    let grantData;
    try {
      // Try to extract JSON from the response
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        grantData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found in response');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError);
      console.error('Raw response was:', analysisText);
      const mockGrant = generateMockGrant(url, pageContent);
      return NextResponse.json({ grant: mockGrant, debug: 'parse_failed' });
    }

    const grant: Grant = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      organizationName: grantData.organizationName || 'Unknown Organization',
      website: actualUrlUsed,
      budgetMin: grantData.budgetMin || 0,
      budgetMax: grantData.budgetMax || 0,
      deadline: grantData.deadline || '',
      deadlineType: grantData.deadlineType || (grantData.deadline ? 'fixed' : undefined),
      rollingDates: grantData.rollingDates || '',
      deadlineNotes: urlNote ? `${urlNote} ${grantData.deadlineNotes || ''}`.trim() : (grantData.deadlineNotes || ''),
      location: grantData.location || '',
      artsDiscipline: grantData.artsDiscipline || 'General Arts',
      fundingType: grantData.fundingType || 'Project-Based',
      funderType: grantData.funderType || 'Private Foundation',
      eligibility: grantData.eligibility || '',
      overview: grantData.overview || '',
      applicationUrl: actualUrlUsed,
      isInvitationOnly: grantData.deadlineType === 'invitation_only',
    };

    return NextResponse.json({ grant, debug: 'claude_ai_used' });
  } catch (error) {
    console.error('Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to analyze URL' },
      { status: 500 }
    );
  }
}

function generateBasicGrantFromUrl(url: string, errorMessage: string): Grant {
  let orgName = 'Unknown Foundation';
  try {
    const urlObj = new URL(url);
    orgName = urlObj.hostname
      .replace('www.', '')
      .split('.')[0]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    // Use default
  }

  // Detect funder type from URL
  let funderType: Grant['funderType'] = 'Private Foundation';
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.gov')) {
    funderType = 'Government';
  } else if (lowerUrl.includes('communityfoundation') || lowerUrl.includes('community-foundation')) {
    funderType = 'Community Foundation';
  }

  return {
    id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    organizationName: orgName,
    website: url,
    budgetMin: 0,
    budgetMax: 0,
    deadline: '',
    deadlineNotes: `Note: ${errorMessage}. Visit the website directly for grant information.`,
    location: 'See Website',
    artsDiscipline: 'General Arts',
    fundingType: 'Project-Based',
    funderType: funderType,
    eligibility: 'Visit website for eligibility details.',
    overview: `Could not automatically analyze this website (${errorMessage}). Please visit ${url} directly to find grant information. Some websites block automated access for security reasons.`,
    applicationUrl: url,
  };
}

function generateMockGrant(url: string, content: string, urlNote?: string): Grant {
  // Extract organization name from URL or content
  let orgName = 'Unknown Foundation';
  try {
    const urlObj = new URL(url);
    orgName = urlObj.hostname
      .replace('www.', '')
      .split('.')[0]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    // Use default
  }

  // Try to find amounts in content
  const amountMatches = content.match(/\$[\d,]+/g) || [];
  const amounts = amountMatches
    .map(m => parseInt(m.replace(/[$,]/g, '')))
    .filter(n => n > 100 && n < 10000000)
    .sort((a, b) => a - b);

  // Try to find dates in content (basic pattern matching)
  const datePatterns = content.match(/(?:January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s*\d{4}/gi) || [];
  let deadline = '';
  let deadlineNotes = '';
  const firstDateMatch = datePatterns[0];
  if (firstDateMatch) {
    try {
      const parsedDate = new Date(firstDateMatch);
      if (!isNaN(parsedDate.getTime())) {
        deadline = parsedDate.toISOString().split('T')[0];
        deadlineNotes = `Found date reference: ${firstDateMatch}. Please verify on official website.`;
      }
    } catch {
      // Ignore parsing errors
    }
  }

  // Try to detect funder type from URL/content
  let funderType: Grant['funderType'] = 'Private Foundation';
  const lowerContent = content.toLowerCase();
  const lowerUrl = url.toLowerCase();
  if (lowerUrl.includes('.gov') || lowerContent.includes('government') || lowerContent.includes('federal')) {
    funderType = 'Government';
  } else if (lowerContent.includes('community foundation')) {
    funderType = 'Community Foundation';
  } else if (lowerContent.includes('corporate') || lowerContent.includes('company')) {
    funderType = 'Corporate';
  }

  return {
    id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    organizationName: orgName,
    website: url,
    budgetMin: amounts[0] || 5000,
    budgetMax: amounts[amounts.length - 1] || 50000,
    deadline: deadline,
    deadlineNotes: urlNote ? `${urlNote} ${deadlineNotes}`.trim() : (deadlineNotes || 'No API key configured. Add ANTHROPIC_API_KEY to .env for detailed AI analysis.'),
    location: 'See Website',
    artsDiscipline: 'General Arts',
    fundingType: 'Project-Based',
    funderType: funderType,
    eligibility: 'Add your Anthropic API key to enable detailed AI analysis of eligibility requirements.',
    overview: `Basic analysis of ${orgName}. For detailed grant information extraction (deadlines, eligibility, funding amounts), add your ANTHROPIC_API_KEY to the .env file. Visit ${url} for complete details.`,
    applicationUrl: url,
  };
}
