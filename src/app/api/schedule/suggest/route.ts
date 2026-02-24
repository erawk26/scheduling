import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { generateSuggestions } from '@/lib/schedule-intelligence/suggester';
import type { AnalysisAppointment, WeeklySuggestions } from '@/lib/schedule-intelligence/types';
import type { SuggesterOptions } from '@/lib/schedule-intelligence/suggester';

interface RequestBody {
  appointmentsByDate: Record<string, AnalysisAppointment[]>;
  options?: SuggesterOptions;
}

export async function POST(request: NextRequest): Promise<NextResponse<WeeklySuggestions | { error: string }>> {
  try {
    const body = (await request.json()) as RequestBody;

    if (!body.appointmentsByDate || typeof body.appointmentsByDate !== 'object') {
      return NextResponse.json({ error: 'appointmentsByDate is required' }, { status: 400 });
    }

    const map = new Map<string, AnalysisAppointment[]>(
      Object.entries(body.appointmentsByDate)
    );

    const suggestions = generateSuggestions(map, body.options);
    return NextResponse.json(suggestions);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate suggestions' },
      { status: 500 }
    );
  }
}
