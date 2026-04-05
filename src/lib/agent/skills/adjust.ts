/**
 * Adjust skill: "Move Sarah to Wednesday" / "Cancel Mrs. Johnson"
 * Reads schedule + clients, writes to appointments.
 */

import { app } from '@/lib/offlinekit';
import { sendMessage } from '@/lib/agent/openrouter-client';
import { buildPrompt } from '@/lib/agent/prompt-builder';
import type { AgentContext } from '@/lib/agent/context/types';
import type { ContextProvider } from '@/lib/agent/context';
import type { WithMeta } from '@erawk26/localkit';
import type { Appointment } from '@/lib/offlinekit/schema';
import type { Skill, SkillResult, SkillExecuteOptions } from './types';

function getAdjustDateRange(): { from: string; to: string } {
  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - 7);
  const to = new Date(now);
  to.setDate(now.getDate() + 14);
  return {
    from: from.toISOString().replace('Z', '').split('.')[0]!,
    to: to.toISOString().replace('Z', '').split('.')[0]!,
  };
}

type SwapTarget = { id: string; newStartTime: string; newEndTime: string };

type AdjustAction =
  | { action: 'cancel'; appointmentId: string }
  | { action: 'reschedule'; appointmentId: string; newStartTime: string; newEndTime: string }
  | { action: 'swap'; appointmentA: SwapTarget; appointmentB: SwapTarget };

function isSwapTarget(v: unknown): v is SwapTarget {
  if (!v || typeof v !== 'object') return false;
  const t = v as Record<string, unknown>;
  return typeof t.id === 'string' && typeof t.newStartTime === 'string' && typeof t.newEndTime === 'string';
}

function extractJson(text: string): string | null {
  const fenced = text.match(/```json\s*([\s\S]*?)```/);
  if (fenced?.[1]) return fenced[1].trim();
  const start = text.indexOf('{');
  if (start === -1) return null;
  let depth = 0;
  for (let i = start; i < text.length; i++) {
    if (text[i] === '{') depth++;
    else if (text[i] === '}') depth--;
    if (depth === 0) return text.slice(start, i + 1);
  }
  return null;
}

function parseAction(llmResponse: string): AdjustAction | null {
  const raw = extractJson(llmResponse);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (parsed.action === 'cancel' && parsed.appointmentId) return parsed as AdjustAction;
    if (parsed.action === 'reschedule' && parsed.appointmentId && parsed.newStartTime) return parsed as AdjustAction;
    if (parsed.action === 'swap' && isSwapTarget(parsed.appointmentA) && isSwapTarget(parsed.appointmentB)) {
      return parsed as AdjustAction;
    }
    return null;
  } catch {
    return null;
  }
}

async function applyCancel(appointmentId: string): Promise<string> {
  const all = await app.appointments.findMany() as unknown as WithMeta<Appointment>[];
  const target = all.find((a) => a.id === appointmentId);
  if (!target) return `Could not find appointment ${appointmentId}.`;

  const now = new Date().toISOString();
  await app.appointments.update(target._id, {
    status: 'cancelled',
    updated_at: now,
  });
  return `Cancelled appointment ${appointmentId}.`;
}

async function applyReschedule(
  appointmentId: string,
  newStartTime: string,
  newEndTime: string,
): Promise<string> {
  const all = await app.appointments.findMany() as unknown as WithMeta<Appointment>[];
  const target = all.find((a) => a.id === appointmentId);
  if (!target) return `Could not find appointment ${appointmentId}.`;

  const now = new Date().toISOString();
  await app.appointments.update(target._id, {
    start_time: newStartTime,
    end_time: newEndTime,
    updated_at: now,
  });
  return `Rescheduled appointment to ${newStartTime}.`;
}

async function applySwap(a: SwapTarget, b: SwapTarget): Promise<string> {
  const all = await app.appointments.findMany() as unknown as WithMeta<Appointment>[];
  const targetA = all.find((apt) => apt.id === a.id);
  const targetB = all.find((apt) => apt.id === b.id);
  if (!targetA) return `Could not find appointment ${a.id}.`;
  if (!targetB) return `Could not find appointment ${b.id}.`;

  const now = new Date().toISOString();
  const origA = { start_time: targetA.start_time, end_time: targetA.end_time };

  await app.appointments.update(targetA._id, {
    start_time: a.newStartTime,
    end_time: a.newEndTime,
    updated_at: now,
  });

  try {
    await app.appointments.update(targetB._id, {
      start_time: b.newStartTime,
      end_time: b.newEndTime,
      updated_at: now,
    });
  } catch {
    await app.appointments.update(targetA._id, {
      start_time: origA.start_time,
      end_time: origA.end_time,
      updated_at: now,
    });
    return `Swap failed — rolled back. Could not update appointment ${b.id}.`;
  }

  return `Swapped: ${a.id} → ${a.newStartTime}, ${b.id} → ${b.newStartTime}.`;
}

export async function applyAction(action: AdjustAction): Promise<string> {
  if (action.action === 'cancel') return applyCancel(action.appointmentId);
  if (action.action === 'reschedule') {
    return applyReschedule(action.appointmentId, action.newStartTime, action.newEndTime);
  }
  return applySwap(action.appointmentA, action.appointmentB);
}

export type { AdjustAction };

export const adjustSkill: Skill = {
  name: 'adjust',
  description: 'Moves or cancels an appointment by client name or date',
  tier: 'L1',
  contextRequirements: ['getScheduleContext', 'getClientContext'],
  writeActions: ['appointments'],
  piiLevel: 'full',

  async execute(
    contextProvider: ContextProvider,
    userMessage: string,
    options: SkillExecuteOptions = {}
  ): Promise<SkillResult> {
    const range = getAdjustDateRange();
    const [schedule, clients] = await Promise.all([
      contextProvider.getScheduleContext(range),
      contextProvider.getClientContext(),
    ]);

    const now = new Date().toISOString().replace('Z', '').split('.')[0]!;
    const labeledAppointments = schedule.appointments.map((apt) => ({
      ...apt,
      status: apt.start_time < now ? `${apt.status} (past)` : apt.status,
    }));
    const labeledSchedule = { ...schedule, appointments: labeledAppointments };

    const agentContext: AgentContext = { query: userMessage, schedule: labeledSchedule, clients };
    const systemPrompt = `You are a scheduling assistant. The user wants to modify an appointment.
Identify the target appointment and action from the context. Respond with a JSON block followed by a friendly confirmation message.
Appointments marked "(past)" have already occurred — do not reschedule into past times.
JSON format:
- Cancel: {"action":"cancel","appointmentId":"<uuid from context>"}
- Reschedule: {"action":"reschedule","appointmentId":"<uuid>","newStartTime":"<ISO>","newEndTime":"<ISO>"}
- Swap: {"action":"swap","appointmentA":{"id":"<uuid>","newStartTime":"<ISO>","newEndTime":"<ISO>"},"appointmentB":{"id":"<uuid>","newStartTime":"<ISO>","newEndTime":"<ISO>"}}
If you cannot identify the appointment, respond naturally asking for clarification.`;

    const messages = buildPrompt(
      { name: 'adjust', systemPrompt, piiLevel: 'full' },
      agentContext,
      userMessage
    );

    const response = await sendMessage(messages, options.openrouterOptions);
    const action = parseAction(response.content);

    if (action) {
      return {
        response,
        skillName: 'adjust',
        pendingAction: action,
      };
    }

    return { response, skillName: 'adjust' };
  },
};
