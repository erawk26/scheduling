/**
 * Weekly digest: summarizes the past week and surfaces detected patterns.
 */

import { format } from 'date-fns';
import { app } from '@/lib/offlinekit';
import type { ContextProvider } from '@/lib/agent/context';
import type { Appointment, Client } from '@/lib/offlinekit/schema';
import { detectPatterns } from './pattern-detector';

function getLastWeekRange(): { from: string; to: string } {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { from: mon.toISOString(), to: sun.toISOString() };
}

function buildStatsBlock(
  total: number,
  completed: number,
  cancelled: number,
  noShows: number
): string {
  return `Appointments: ${total} total — ${completed} completed, ${cancelled} cancelled, ${noShows} no-shows`;
}

function buildPatternBlock(patterns: ReturnType<typeof detectPatterns>): string {
  if (patterns.length === 0) return '';
  const lines = ['Patterns detected:'];
  for (const p of patterns) {
    lines.push(`• ${p.description}`);
    lines.push(`  → ${p.suggestion}`);
  }
  return lines.join('\n');
}

function buildSuggestionsBlock(
  cancelledClients: string[],
  hasAreaClustering: boolean
): string {
  const lines = ['Suggestions for next week:'];
  if (cancelledClients.length > 0) {
    lines.push(`• Follow up with: ${cancelledClients.join(', ')}`);
  }
  if (hasAreaClustering) {
    lines.push('• Consider grouping appointments by area to reduce drive time');
  }
  return lines.length > 1 ? lines.join('\n') : '';
}

export async function generateWeeklyDigest(contextProvider: ContextProvider): Promise<string> {
  const range = getLastWeekRange();
  const schedule = await contextProvider.getScheduleContext(range);

  const apts = schedule.appointments;
  const completed = apts.filter((a) => a.status === 'completed').length;
  const cancelled = apts.filter((a) => a.status === 'cancelled').length;
  const noShows = apts.filter((a) => a.status === 'no_show').length;

  const [rawApts, allClients] = await Promise.all([
    app.appointments.findMany() as unknown as Appointment[],
    app.clients.findMany() as unknown as Client[],
  ]);

  const clientNames = new Map<string, string>(
    allClients.map((c) => [c.id, `${c.first_name} ${c.last_name}`])
  );

  const patterns = detectPatterns(rawApts, 4, clientNames);

  const cancelledClients = [
    ...new Set(apts.filter((a) => a.status === 'cancelled').map((a) => a.clientName)),
  ];
  const hasAreaClustering = patterns.some((p) => p.type === 'area-clustering');

  const header = `Week of ${format(new Date(range.from), 'MMM d')} – ${format(new Date(range.to), 'MMM d, yyyy')}`;
  const statsBlock = buildStatsBlock(apts.length, completed, cancelled, noShows);
  const patternBlock = buildPatternBlock(patterns);
  const suggestionsBlock = buildSuggestionsBlock(cancelledClients, hasAreaClustering);

  return [header, '', statsBlock, patternBlock, suggestionsBlock]
    .filter(Boolean)
    .join('\n\n');
}
