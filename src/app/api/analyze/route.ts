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

    try {
      // Try HTTPS first
      let response = await fetchWithTimeout(normalizedUrl);

      // If HTTPS fails with certain errors, try original URL
      if (!response.ok && url.startsWith('http://')) {
        try {
          response = await fetchWithTimeout(url);
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
        // Strip HTML tags for text content (basic extraction)
        pageContent = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 15000); // Limit content length for API
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      if (errorMessage.includes('abort')) {
        fetchError = 'Website took too long to respond (timeout)';
      } else if (errorMessage.includes('ENOTFOUND') || errorMessage.includes('getaddrinfo')) {
        fetchError = 'Website not found - check the URL';
      } else if (errorMessage.includes('certificate') || errorMessage.includes('SSL')) {
        fetchError = 'Website has SSL/security issues';
      } else {
        fetchError = `Could not reach website: ${errorMessage}`;
      }
      console.error('Fetch error:', err);
    }

    // If we couldn't get content and there's no API key, return basic info from URL
    if (!pageContent && fetchError) {
      const basicGrant = generateBasicGrantFromUrl(url, fetchError);
      return NextResponse.json({ grant: basicGrant });
    }

    // Check if Claude API key is available
    const apiKey = process.env.ANTHROPIC_API_KEY;

    if (!apiKey) {
      // Return mock data for demo purposes when no API key
      const mockGrant = generateMockGrant(url, pageContent);
      return NextResponse.json({ grant: mockGrant });
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
            content: `You are analyzing a grant foundation's website to extract grant information for performing arts and music organizations. Extract as much specific detail as possible.

IMPORTANT INSTRUCTIONS:
- For budgetMin/budgetMax: Look for specific dollar amounts mentioned. Extract actual numbers, not ranges like "varies". If you see "$5,000 to $50,000", use 5000 and 50000.
- For deadline: Look for specific dates like "March 15, 2026" or "February 1". Format as YYYY-MM-DD. If it says "rolling" or "ongoing", leave empty.
- For location: Find the organization's headquarters city and state (e.g., "New York, NY", "Washington, DC").
- For eligibility: Be specific - mention 501(c)(3) requirements, geographic restrictions, budget size limits, years in operation needed, etc.
- For overview: Summarize what this grant actually funds, who it's for, and any special focus areas.

Return ONLY a valid JSON object (no markdown, no explanation, no code blocks) with these exact fields:

{
  "organizationName": "Full official name of the foundation/organization",
  "budgetMin": number (minimum grant amount in dollars, 0 only if truly not stated),
  "budgetMax": number (maximum grant amount in dollars, 0 only if truly not stated),
  "deadline": "YYYY-MM-DD format, or empty string if rolling/ongoing/not specified",
  "deadlineNotes": "Additional deadline info like 'Two cycles: Spring and Fall' or 'Letter of intent due 2 weeks prior'",
  "location": "City, State (organization headquarters)",
  "artsDiscipline": "Classical Music" | "General Arts" | "Humanities" | "Performing Arts" | "Music Education",
  "fundingType": "General Operating" | "Project-Based" | "Capital" | "Fellowship" | "Commissioning",
  "funderType": "Government" | "Private Foundation" | "Corporate" | "Community Foundation" | "Service Organization",
  "eligibility": "Specific eligibility requirements - be detailed about who can apply",
  "overview": "3-4 sentence summary: What does this grant fund? Who is it for? What's unique about it?"
}

Webpage URL: ${url}
Webpage Content:
${pageContent}`
          }
        ],
      }),
    });

    if (!claudeResponse.ok) {
      console.error('Claude API error:', await claudeResponse.text());
      // Fallback to mock data
      const mockGrant = generateMockGrant(url, pageContent);
      return NextResponse.json({ grant: mockGrant });
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
      const mockGrant = generateMockGrant(url, pageContent);
      return NextResponse.json({ grant: mockGrant });
    }

    const grant: Grant = {
      id: `ai-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      organizationName: grantData.organizationName || 'Unknown Organization',
      website: url,
      budgetMin: grantData.budgetMin || 0,
      budgetMax: grantData.budgetMax || 0,
      deadline: grantData.deadline || '',
      deadlineNotes: grantData.deadlineNotes || '',
      location: grantData.location || 'Unknown',
      artsDiscipline: grantData.artsDiscipline || 'General Arts',
      fundingType: grantData.fundingType || 'Project-Based',
      funderType: grantData.funderType || 'Private Foundation',
      eligibility: grantData.eligibility || 'See website for eligibility requirements.',
      overview: grantData.overview || 'Grant information extracted from website. Visit the website for complete details.',
      applicationUrl: url,
    };

    return NextResponse.json({ grant });
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

function generateMockGrant(url: string, content: string): Grant {
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
    deadlineNotes: deadlineNotes || 'No API key configured. Add ANTHROPIC_API_KEY to .env for detailed AI analysis.',
    location: 'See Website',
    artsDiscipline: 'General Arts',
    fundingType: 'Project-Based',
    funderType: funderType,
    eligibility: 'Add your Anthropic API key to enable detailed AI analysis of eligibility requirements.',
    overview: `Basic analysis of ${orgName}. For detailed grant information extraction (deadlines, eligibility, funding amounts), add your ANTHROPIC_API_KEY to the .env file. Visit ${url} for complete details.`,
    applicationUrl: url,
  };
}
