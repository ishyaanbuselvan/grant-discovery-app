import { NextResponse } from 'next/server';

export async function GET() {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  const results: Record<string, unknown> = {
    apiKeyExists: !!apiKey,
    apiKeyLength: apiKey?.length || 0,
    apiKeyPrefix: apiKey?.slice(0, 10) || 'none',
    timestamp: new Date().toISOString(),
  };

  // Test fetch
  try {
    const testFetch = await fetch('https://www.seattlefoundation.org', {
      headers: { 'User-Agent': 'Mozilla/5.0' },
    });
    results.fetchTest = {
      status: testFetch.status,
      ok: testFetch.ok,
    };
  } catch (err) {
    results.fetchTest = { error: err instanceof Error ? err.message : 'unknown' };
  }

  // Test Claude API
  if (apiKey) {
    try {
      const claudeTest = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-haiku-20240307',
          max_tokens: 50,
          messages: [{ role: 'user', content: 'Say "API working" and nothing else.' }],
        }),
      });

      if (claudeTest.ok) {
        const data = await claudeTest.json();
        results.claudeTest = {
          status: 'success',
          response: data.content[0]?.text || 'no text',
        };
      } else {
        const errText = await claudeTest.text();
        results.claudeTest = {
          status: 'failed',
          httpStatus: claudeTest.status,
          error: errText.slice(0, 200),
        };
      }
    } catch (err) {
      results.claudeTest = { error: err instanceof Error ? err.message : 'unknown' };
    }
  } else {
    results.claudeTest = { error: 'No API key to test' };
  }

  return NextResponse.json(results);
}
