import { NextRequest, NextResponse } from 'next/server';
import { geocode } from '@/lib/graphhopper/client';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { address } = body;

    if (!address || typeof address !== 'string') {
      return NextResponse.json({ error: 'Address is required' }, { status: 400 });
    }

    if (!process.env.GRAPHHOPPER_API_KEY) {
      return NextResponse.json({ error: 'Geocoding not configured' }, { status: 503 });
    }

    const result = await geocode(address);

    if (!result) {
      return NextResponse.json({ error: 'Address not found' }, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('[Geocode API]', error);
    return NextResponse.json(
      { error: 'Geocoding failed' },
      { status: 500 }
    );
  }
}
