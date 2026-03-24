/**
 * Adjust skill: "Move Sarah to Wednesday" / "Cancel Mrs. Johnson"
 * Reads schedule + clients, writes to appointments.
 */

import { app } from '@/lib/offlinekit';
import { sendMessage } from '@/lib/agent/openrouter-client';
import { buildPrompt } from '@/lib/agent/prompt-builder';
import type { AgentContext } from '@/lib/agent/types';
import type { ContextProvider, ScheduleContext, ClientContext } from '@/lib/agent/context';
import type { WithMeta } from 'mpb-localkit';
import type { Appointment } from '@/lib/offlinekit/schema';
import type { Skill, SkillResult, SkillExecuteOptions } from './types';

function getTwoWeekRange(): { from: string; to: string } {
  const now = new Date();
  const end = new Date(now);
  end.setDate(now.getDate() + 14);
  return { from: now.toISOString(), to: end.toISOString() };
}

function toAgentContext(schedule: ScheduleContext, clients: ClientContext): AgentContext {
  return {
    upcomingAppointments: schedule.appointments.map((apt) => ({
      id: apt.id,
      clientName: apt.clientName,
      serviceName: apt.serviceName,
      startTime: apt.start_time,
      address: apt.address ?? undefined,
    })),
    clients: clients.clients.map((c) => ({
      id: c.id,
      name: `${c.first_name} ${c.last_name}`,
      address: c.address ?? undefined,
      flexibility: c.scheduling_flexibility,
    })),
  };
}

type AdjustAction =
  | { action: 'cancel'; appointmentId: string }
  | { action: 'reschedule'; appointmentId: string; newStartTime: string; newEndTime: string };

function parseAction(llmResponse: string): AdjustAction | null {
  const match = llmResponse.match(/```json\s*([\s\S]*?)```|(\{[\s\S]*?\})/);
  const raw = match?.[1] ?? match?.[2];
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as AdjustAction;
    if (parsed.action === 'cancel' && parsed.appointmentId) return parsed;
    if (parsed.action === 'reschedule' && parsed.appointmentId && parsed.newStartTime) return parsed;
    return null;
  } catch {
    return null;
  }
}

async function applyAction(action: AdjustAction): Promise<string> {
  const all = await app.appointments.findMany() as unknown as WithMeta<Appointment>[];
  const target = all.find((a) => a.id === action.appointmentId);
  if (!target) return `Could not find appointment ${action.appointmentId}.`;

  const now = new Date().toISOString();
  if (action.action === 'cancel') {
    await app.appointments.update(target._id, {
      status: 'cancelled',
      updated_at: now,
      needs_sync: 1,
      sync_operation: 'UPDATE',
    });
    return `Cancelled appointment for ${action.appointmentId}.`;
  }

  await app.appointments.update(target._id, {
    start_time: action.newStartTime,
    end_time: action.newEndTime,
    updated_at: now,
    needs_sync: 1,
    sync_operation: 'UPDATE',
  });
  return `Rescheduled appointment to ${action.newStartTime}.`;
}

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
    const range = getTwoWeekRange();
    const [schedule, clients] = await Promise.all([
      contextProvider.getScheduleContext(range),
      contextProvider.getClientContext(),
    ]);

    const agentContext = toAgentContext(schedule, clients);
    const systemPrompt = `You are a scheduling assistant. The user wants to modify an appointment.
Identify the target appointment and action from the context. Respond with a JSON block followed by a friendly confirmation message.
JSON format:
- Cancel: {"action":"cancel","appointmentId":"<uuid from context>"}
- Reschedule: {"action":"reschedule","appointmentId":"<uuid>","newStartTime":"<ISO>","newEndTime":"<ISO>"}
If you cannot identify the appointment, respond naturally asking for clarification.`;

    const messages = buildPrompt(
      { name: 'adjust', systemPrompt, piiLevel: 'full' },
      agentContext,
      userMessage
    );

    const response = await sendMessage(messages, options.openrouterOptions);
    const action = parseAction(response.content);

    if (action) {
      const applyResult = await applyAction(action);
      return {
        response: { ...response, content: `${applyResult}\n\n${response.content}` },
        skillName: 'adjust',
      };
    }

    return { response, skillName: 'adjust' };
  },
};
