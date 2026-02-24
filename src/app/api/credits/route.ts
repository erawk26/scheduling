import { NextResponse } from 'next/server';
import { creditTracker } from '@/lib/graphhopper/client';

export async function GET() {
  const usage = creditTracker.getUsage();
  return NextResponse.json(usage);
}
