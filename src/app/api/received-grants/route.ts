import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

const RECEIVED_GRANTS_KEY = 'luminarts-received-grants';

// GET - fetch all received grant IDs
export async function GET() {
  try {
    const receivedGrants = await redis.smembers(RECEIVED_GRANTS_KEY);
    return NextResponse.json({ receivedGrants: receivedGrants || [] });
  } catch (error) {
    console.error('Error fetching received grants:', error);
    return NextResponse.json({ receivedGrants: [] });
  }
}

// POST - add a grant ID to received list
export async function POST(request: NextRequest) {
  try {
    const { grantId } = await request.json();
    if (!grantId) {
      return NextResponse.json({ error: 'grantId required' }, { status: 400 });
    }
    await redis.sadd(RECEIVED_GRANTS_KEY, grantId);
    const receivedGrants = await redis.smembers(RECEIVED_GRANTS_KEY);
    return NextResponse.json({ success: true, receivedGrants });
  } catch (error) {
    console.error('Error adding received grant:', error);
    return NextResponse.json({ error: 'Failed to add grant' }, { status: 500 });
  }
}

// DELETE - remove a grant ID from received list
export async function DELETE(request: NextRequest) {
  try {
    const { grantId } = await request.json();
    if (!grantId) {
      return NextResponse.json({ error: 'grantId required' }, { status: 400 });
    }
    await redis.srem(RECEIVED_GRANTS_KEY, grantId);
    const receivedGrants = await redis.smembers(RECEIVED_GRANTS_KEY);
    return NextResponse.json({ success: true, receivedGrants });
  } catch (error) {
    console.error('Error removing received grant:', error);
    return NextResponse.json({ error: 'Failed to remove grant' }, { status: 500 });
  }
}
