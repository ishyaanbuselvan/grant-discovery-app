import { NextRequest, NextResponse } from 'next/server';
import { Grant } from '@/lib/types';
import puppeteer from 'puppeteer-core';
import chromium from '@sparticuz/chromium';

// Get browser instance
async function getBrowser() {
  return puppeteer.launch({
    args: chromium.args,
    defaultViewport: { width: 1280, height: 720 },
    executablePath: await chromium.executablePath(),
    headless: true,
  });
}

// Scrape a single page with real browser
async function scrapePage(browser: Awaited<ReturnType<typeof getBrowser>>, url: string, timeout = 10000): Promise<string> {
  const page = await browser.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout });

    // Get rendered text content
    const content = await page.evaluate(() => {
      // Remove scripts and styles
      document.querySelectorAll('script, style, nav, footer, header').forEach(el => el.remove());
      return document.body?.innerText || '';
    });

    return content.slice(0, 5000);
  } catch (error) {
    console.error(`Failed to scrape ${url}:`, error);
    return '';
  } finally {
    await page.close();
  }
}

// Find grant-related links on a page
async function findGrantLinks(browser: Awaited<ReturnType<typeof getBrowser>>, url: string): Promise<string[]> {
  const page = await browser.newPage();
  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 15000 });

    const links = await page.evaluate((baseUrl) => {
      const keywords = ['grant', 'fund', 'apply', 'deadline', 'eligib', 'guideline', 'program', 'application', 'nonprofit', 'about', 'contact'];
      const allLinks = Array.from(document.querySelectorAll('a[href]'));

      return allLinks
        .map(a => {
          const href = a.getAttribute('href') || '';
          const text = a.textContent?.toLowerCase() || '';
          // Convert relative to absolute
          try {
            return new URL(href, baseUrl).href;
          } catch {
            return null;
          }
        })
        .filter((href): href is string => {
          if (!href) return false;
          const lowerHref = href.toLowerCase();
          // Only same domain
          if (!lowerHref.startsWith(baseUrl.split('/').slice(0, 3).join('/'))) return false;
          // Must contain grant keyword
          return keywords.some(kw => lowerHref.includes(kw));
        })
        .slice(0, 10);
    }, url);

    return [...new Set(links)];
  } catch (error) {
    console.error('Failed to find links:', error);
    return [];
  } finally {
    await page.close();
  }
}

export async function POST(request: NextRequest) {
  let browser;

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

    console.log('Starting browser scrape for:', normalizedUrl);

    // Launch real browser
    browser = await getBrowser();

    // Scrape main page
    let allContent = `=== MAIN PAGE: ${normalizedUrl} ===\n`;
    const mainContent = await scrapePage(browser, normalizedUrl, 15000);

    if (!mainContent) {
      await browser.close();
      return NextResponse.json({
        grant: generateBasicGrantFromUrl(url, 'Could not load website'),
        debug: 'scrape_failed'
      });
    }

    allContent += mainContent + '\n\n';

    // Find and scrape additional grant-related pages
    const grantLinks = await findGrantLinks(browser, normalizedUrl);
    console.log(`Found ${grantLinks.length} grant-related links`);

    // Scrape up to 5 additional pages
    for (const link of grantLinks.slice(0, 5)) {
      if (link !== normalizedUrl) {
        console.log('Scraping:', link);
        const pageContent = await scrapePage(browser, link, 8000);
        if (pageContent) {
          allContent += `=== PAGE: ${link} ===\n${pageContent}\n\n`;
        }
      }
    }

    await browser.close();
    browser = undefined;

    // Limit content
    const pageContent = allContent.slice(0, 30000);
    console.log(`Total content length: ${pageContent.length}`);

    // Check for API key
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      return NextResponse.json({
        grant: generateMockGrant(normalizedUrl, pageContent),
        debug: 'no_api_key'
      });
    }

    // Call Claude API
    const claudeResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2500,
        messages: [
          {
            role: 'user',
            content: `You are extracting grant information from a foundation's website. The content below was scraped from multiple pages of their site.

CRITICAL RULES - FOLLOW EXACTLY:

1. ORGANIZATION NAME: Extract the EXACT official name with proper spacing and capitalization.

2. DEADLINES:
   - Search the content carefully for ANY dates mentioned (application deadlines, LOI due dates, quarterly cycles)
   - For ROLLING/QUARTERLY deadlines: List ALL cycle dates (e.g., "Jan 31, Apr 30, Jul 31, Oct 31")
   - For FIXED annual deadlines: Find the specific date
   - Use 2025 or 2026 dates - NEVER use past years (2024 or earlier)
   - Set deadlineType: "rolling" for multiple deadlines per year, "fixed" for one deadline, "invitation_only" if by invitation only

3. LOCATION: Find the foundation's physical address/headquarters. Look in footer, contact page, or about section. Return as "City, State" format.

4. BUDGET/GRANT AMOUNTS: Find specific dollar amounts mentioned for grant sizes, award ranges, or funding levels.

5. ELIGIBILITY: Extract ALL specific requirements: 501(c)(3) status, geographic restrictions, organization budget limits, years in operation, etc.

6. IF INFO NOT FOUND: Use empty string "" or 0 - DO NOT GUESS OR MAKE UP DATA.

Return ONLY valid JSON (no markdown, no code blocks):

{
  "organizationName": "Properly Spaced Foundation Name",
  "budgetMin": number (0 if not found),
  "budgetMax": number (0 if not found),
  "deadline": "YYYY-MM-DD of next upcoming deadline, or empty string",
  "deadlineType": "fixed" | "rolling" | "invitation_only",
  "rollingDates": "For rolling: Jan 31, Apr 30, Jul 31, Oct 31 (or similar)",
  "deadlineNotes": "Additional deadline details",
  "location": "City, State",
  "artsDiscipline": "Classical Music" | "General Arts" | "Humanities" | "Performing Arts" | "Music Education",
  "fundingType": "General Operating" | "Project-Based" | "Capital" | "Fellowship" | "Commissioning",
  "funderType": "Government" | "Private Foundation" | "Corporate" | "Community Foundation" | "Service Organization",
  "eligibility": "All specific requirements found",
  "overview": "2-3 sentence factual summary of what this grant funds"
}

Website URL: ${normalizedUrl}

SCRAPED CONTENT FROM WEBSITE:
${pageContent}`
          }
        ],
      }),
    });

    if (!claudeResponse.ok) {
      const errorText = await claudeResponse.text();
      console.error('Claude API error:', errorText);
      return NextResponse.json({
        grant: generateMockGrant(normalizedUrl, pageContent),
        debug: 'claude_api_failed',
        error: errorText
      });
    }

    const claudeData = await claudeResponse.json();
    const analysisText = claudeData.content[0]?.text || '';

    // Parse JSON
    let grantData;
    try {
      const jsonMatch = analysisText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        grantData = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('No JSON found');
      }
    } catch (parseError) {
      console.error('Parse error:', parseError, 'Response:', analysisText);
      return NextResponse.json({
        grant: generateMockGrant(normalizedUrl, pageContent),
        debug: 'parse_failed'
      });
    }

    // Format organization name
    const formatOrgName = (name: string): string => {
      if (!name) return 'Unknown Organization';
      let formatted = name.replace(/([a-z])([A-Z])/g, '$1 $2');
      formatted = formatted.split(' ').map(word =>
        word.charAt(0).toUpperCase() + word.slice(1)
      ).join(' ');
      return formatted;
    };

    const grant: Grant = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      organizationName: formatOrgName(grantData.organizationName),
      website: normalizedUrl,
      budgetMin: grantData.budgetMin || 0,
      budgetMax: grantData.budgetMax || 0,
      deadline: grantData.deadline || '',
      deadlineType: grantData.deadlineType || undefined,
      rollingDates: grantData.rollingDates || '',
      deadlineNotes: grantData.deadlineNotes || '',
      location: grantData.location || '',
      artsDiscipline: grantData.artsDiscipline || 'General Arts',
      fundingType: grantData.fundingType || 'Project-Based',
      funderType: grantData.funderType || 'Private Foundation',
      eligibility: grantData.eligibility || '',
      overview: grantData.overview || '',
      applicationUrl: normalizedUrl,
      isInvitationOnly: grantData.deadlineType === 'invitation_only',
    };

    return NextResponse.json({ grant, debug: 'browser_scrape_success' });

  } catch (error) {
    console.error('Analysis error:', error);
    if (browser) {
      try { await browser.close(); } catch {}
    }
    return NextResponse.json(
      { error: 'Failed to analyze URL', details: error instanceof Error ? error.message : 'Unknown' },
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
  } catch {}

  return {
    id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    organizationName: orgName,
    website: url,
    budgetMin: 0,
    budgetMax: 0,
    deadline: '',
    deadlineNotes: `Note: ${errorMessage}. Visit the website directly.`,
    location: '',
    artsDiscipline: 'General Arts',
    fundingType: 'Project-Based',
    funderType: 'Private Foundation',
    eligibility: '',
    overview: `Could not analyze (${errorMessage}). Visit ${url} directly.`,
    applicationUrl: url,
  };
}

function generateMockGrant(url: string, content: string): Grant {
  let orgName = 'Unknown Foundation';
  try {
    const urlObj = new URL(url);
    orgName = urlObj.hostname
      .replace('www.', '')
      .split('.')[0]
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {}

  return {
    id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    organizationName: orgName,
    website: url,
    budgetMin: 0,
    budgetMax: 0,
    deadline: '',
    deadlineNotes: 'API key required for detailed analysis.',
    location: '',
    artsDiscipline: 'General Arts',
    fundingType: 'Project-Based',
    funderType: 'Private Foundation',
    eligibility: '',
    overview: `Basic scrape of ${orgName}. Add ANTHROPIC_API_KEY for AI analysis.`,
    applicationUrl: url,
  };
}
