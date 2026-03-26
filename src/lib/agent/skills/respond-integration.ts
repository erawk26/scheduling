/**
 * Response-Integration skill: "Check responses" / "Who has confirmed?"
 * L1 skill — reads booking confirmations from .omc/bookings/, updates appointment status,
 * detects conflicts, and surfaces a response summary to the user.
 */

import fs from 'fs/promises';
import path from 'path';
import { app } from '@/lib/offlinekit';
import { sendMessage } from '@/lib/agent/openrouter-client';
import type { ContextProvider, ScheduleContext, NotesContext, AppointmentSummary } from '@/lib/agent/context';
import type { ChatMessage } from '@/lib/agent/types';
import type { Skill, SkillResult, SkillExecuteOptions } from './types';

const BOOKINGS_DIR = path.join(process.cwd(), '.omc', 'bookings');

interface BookingResponse {
  appointmentId: string;
  clientId: string;
  clientName: string;
  chosenSlot: string;
  status: 'confirmed' | 'declined';
  reason?: string;
}

async function readBookingResponses(): Promise<BookingResponse[]> {
  try {
    const entries = await fs.readdir(BOOKINGS_DIR);
    const jsonFiles = entries.filter((f) => f.endsWith('.json'));
    const results = await Promise.all(
      jsonFiles.map(async (file) => {
        try {
          const raw = await fs.readFile(path.join(BOOKINGS_DIR, file), 'utf-8');
          return JSON.parse(raw) as BookingResponse;
        } catch {
          return null;
        }
      })
    );
    return results.filter((r): r is BookingResponse => r !== null);
  } catch {
    // Directory doesn't exist yet — no responses
    return [];
  }
}

function detectConflicts(confirmed: BookingResponse[]): string[] {
  const conflicts: string[] = [];
  for (let i = 0; i < confirmed.length; i++) {
    for (let j = i + 1; j < confirmed.length; j++) {
      const a = confirmed[i];
      const b = confirmed[j];
      if (!a || !b) continue;
      if (a.chosenSlot === b.chosenSlot) {
        conflicts.push(`Conflict: ${a.clientName} and ${b.clientName} both chose ${a.chosenSlot}`);
      }
    }
  }
  return conflicts;
}

async function updateConfirmedAppointments(
  confirmed: BookingResponse[],
  schedule: ScheduleContext
): Promise<number> {
  const aptMap = new Map<string, AppointmentSummary>(
    schedule.appointments.map((a) => [a.id, a])
  );

  let updated = 0;
  for (const booking of confirmed) {
    const apt = aptMap.get(booking.appointmentId);
    if (!apt || apt.status !== 'draft') continue;
    try {
      const allAppointments = await app.appointments.findMany() as Array<{ _id: string; id: string }>;
      const doc = allAppointments.find((a) => a.id === booking.appointmentId);
      if (!doc) continue;
      await app.appointments.update(doc._id, {
        status: 'confirmed',
        updated_at: new Date().toISOString(),
        needs_sync: 1,
        sync_operation: 'UPDATE',
      });
      updated++;
    } catch {
      // Skip failed updates
    }
  }
  return updated;
}

async function saveResponseSummary(
  confirmed: BookingResponse[],
  declined: BookingResponse[],
  noResponse: string[],
  conflicts: string[]
): Promise<void> {
  const now = new Date().toISOString();
  const parts = [
    `Confirmed (${confirmed.length}): ${confirmed.map((c) => c.clientName).join(', ') || 'none'}`,
    `Declined (${declined.length}): ${declined.map((c) => c.clientName).join(', ') || 'none'}`,
    `No response (${noResponse.length}): ${noResponse.join(', ') || 'none'}`,
    conflicts.length > 0 ? `Conflicts: ${conflicts.join('; ')}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  await app.agentNotes.create({
    id: crypto.randomUUID(),
    user_id: '00000000-0000-0000-0000-000000000000',
    summary: `Booking response summary: ${confirmed.length} confirmed, ${declined.length} declined, ${noResponse.length} no response`,
    content: parts,
    tags: ['booking-response'],
    date_ref: now,
    client_id: null,
    created_at: now,
    updated_at: now,
    version: 1,
    synced_at: null,
    deleted_at: null,
    needs_sync: 1,
    sync_operation: 'INSERT',
  });
}

function buildSystemPrompt(
  confirmed: BookingResponse[],
  declined: BookingResponse[],
  noResponse: string[],
  conflicts: string[],
  updatedCount: number
): string {
  const lines: string[] = [];

  if (confirmed.length > 0) {
    lines.push(`Confirmed (${confirmed.length}):`);
    confirmed.forEach((c) => lines.push(`  - ${c.clientName}: ${c.chosenSlot.slice(0, 16).replace('T', ' ')}`));
  }

  if (declined.length > 0) {
    lines.push(`Declined (${declined.length}):`);
    declined.forEach((c) => lines.push(`  - ${c.clientName}${c.reason ? `: ${c.reason}` : ''}`));
  }

  if (noResponse.length > 0) {
    lines.push(`No response yet (${noResponse.length}):`);
    noResponse.forEach((name) => lines.push(`  - ${name}`));
  }

  if (conflicts.length > 0) {
    lines.push(`\n⚠️ Scheduling conflicts detected:`);
    conflicts.forEach((c) => lines.push(`  - ${c}`));
  }

  return `You are a scheduling assistant for a mobile pet service professional.
Here is the current booking response status:

${lines.join('\n')}

${updatedCount > 0 ? `${updatedCount} appointment${updatedCount === 1 ? '' : 's'} updated to confirmed.` : ''}

Write a brief, friendly summary of who has responded and what action may be needed.
If there are conflicts, clearly flag them and suggest resolution options.
If all clients have responded, note that the schedule is ready for final review.`;
}

function getWeekRange(): { from: string; to: string } {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const daysUntilNextMon = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
  const mon = new Date(now);
  mon.setDate(now.getDate() + daysUntilNextMon);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return { from: mon.toISOString(), to: sun.toISOString() };
}

function getNoResponseList(
  schedule: ScheduleContext,
  notes: NotesContext,
  allResponses: BookingResponse[]
): string[] {
  const outreachNote = notes.notes
    .filter((n) => n.tags.includes('outreach-plan'))
    .sort((a, b) => (b.date_ref ?? '').localeCompare(a.date_ref ?? ''))[0];

  if (!outreachNote?.content) {
    // Fall back to draft appointments with no booking response
    const respondedIds = new Set(allResponses.map((r) => r.appointmentId));
    return schedule.appointments
      .filter((apt) => apt.status === 'draft' && !respondedIds.has(apt.id))
      .map((apt) => apt.clientName)
      .filter((name, i, arr) => arr.indexOf(name) === i);
  }

  try {
    const plan = JSON.parse(outreachNote.content) as { clients: Array<{ clientName: string }> };
    const respondedNames = new Set(allResponses.map((r) => r.clientName));
    return plan.clients
      .map((c) => c.clientName)
      .filter((name) => !respondedNames.has(name));
  } catch {
    return [];
  }
}

export const respondIntegrationSkill: Skill = {
  name: 'response-integration',
  description: 'Checks booking responses and updates schedule accordingly',
  tier: 'L1',
  contextRequirements: ['getScheduleContext', 'getNotesContext'],
  writeActions: ['appointments', 'agentNotes'],
  piiLevel: 'full',

  async execute(
    contextProvider: ContextProvider,
    userMessage: string,
    options: SkillExecuteOptions = {}
  ): Promise<SkillResult> {
    const weekRange = getWeekRange();
    const [schedule, notes, allResponses] = await Promise.all([
      contextProvider.getScheduleContext(weekRange),
      contextProvider.getNotesContext(),
      readBookingResponses(),
    ]);

    const confirmed = allResponses.filter((r) => r.status === 'confirmed');
    const declined = allResponses.filter((r) => r.status === 'declined');
    const noResponse = getNoResponseList(schedule, notes, allResponses);
    const conflicts = detectConflicts(confirmed);

    const updatedCount = await updateConfirmedAppointments(confirmed, schedule);
    await saveResponseSummary(confirmed, declined, noResponse, conflicts);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: buildSystemPrompt(confirmed, declined, noResponse, conflicts, updatedCount),
      },
      { role: 'user', content: userMessage },
    ];

    const response = await sendMessage(messages, options.openrouterOptions);
    return { response, skillName: 'response-integration' };
  },
};
