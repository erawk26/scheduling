/**
 * Report skill: Weekly summary with route efficiency analysis.
 * Uses schedule intelligence analyzer logic.
 */

import { format } from 'date-fns';
import { sendMessage } from '@/lib/agent/openrouter-client';
import { buildPrompt } from '@/lib/agent/prompt-builder';
import type { AgentContext } from '@/lib/agent/context/types';
import type { ContextProvider, ScheduleContext } from '@/lib/agent/context';
import { analyzeWeekEfficiency } from '@/lib/schedule-intelligence/analyzer';
import type { AnalysisAppointment } from '@/lib/schedule-intelligence/types';
import type { Skill, SkillResult, SkillExecuteOptions } from './types';

function getLastWeekRange(): { from: string; to: string; weekStart: string } {
  const now = new Date();
  const mon = new Date(now);
  mon.setDate(now.getDate() - ((now.getDay() + 6) % 7) - 7);
  mon.setHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setDate(mon.getDate() + 6);
  sun.setHours(23, 59, 59, 999);
  return {
    from: mon.toISOString(),
    to: sun.toISOString(),
    weekStart: format(mon, 'yyyy-MM-dd'),
  };
}

function toAnalysisAppointments(schedule: ScheduleContext): Map<string, AnalysisAppointment[]> {
  const byDate = new Map<string, AnalysisAppointment[]>();

  for (const apt of schedule.appointments) {
    const date = apt.start_time.slice(0, 10);
    const list = byDate.get(date) ?? [];
    list.push({
      id: apt.id,
      clientId: apt.id, // fallback — clientId not in AppointmentSummary
      clientName: apt.clientName,
      serviceId: apt.id,
      serviceName: apt.serviceName,
      startTime: apt.start_time,
      endTime: apt.end_time,
      durationMinutes: Math.round(
        (new Date(apt.end_time).getTime() - new Date(apt.start_time).getTime()) / 60000
      ),
      latitude: 0,
      longitude: 0,
      flexibility: 'unknown',
    });
    byDate.set(date, list);
  }

  return byDate;
}

export const reportSkill: Skill = {
  name: 'report',
  description: 'Generates a weekly summary with appointment stats and route efficiency',
  tier: 'L0',
  contextRequirements: ['getScheduleContext'],
  writeActions: [],
  piiLevel: 'full',

  async execute(
    contextProvider: ContextProvider,
    userMessage: string,
    options: SkillExecuteOptions = {}
  ): Promise<SkillResult> {
    const { from, to, weekStart } = getLastWeekRange();
    const schedule = await contextProvider.getScheduleContext({ from, to });

    const byDate = toAnalysisAppointments(schedule);
    const efficiency = analyzeWeekEfficiency(weekStart, byDate);

    const efficiencyText = [
      `Week of ${efficiency.weekStart} → ${efficiency.weekEnd}`,
      `Total appointments: ${schedule.appointments.length}`,
      `Route efficiency: ${efficiency.totalEfficiencyPercent.toFixed(1)}%`,
      `Estimated wasted travel: ${efficiency.totalWastedMinutes.toFixed(0)} minutes`,
    ].join('\n');

    const agentContext: AgentContext = {
      query: userMessage,
      schedule,
      notes: {
        notes: [{
          id: 'efficiency',
          summary: efficiencyText,
          content: null,
          tags: ['route-efficiency'],
          date_ref: weekStart,
          client_id: null,
        }],
      },
    };
    const systemPrompt = `You are a scheduling assistant. Produce a concise weekly summary covering: appointments completed, any no-shows or cancellations, route efficiency highlights, and any patterns worth noting. Keep it under 200 words.`;

    const messages = buildPrompt(
      { name: 'report', systemPrompt, piiLevel: 'full' },
      agentContext,
      userMessage
    );

    const response = await sendMessage(messages, options.openrouterOptions);
    return { response, skillName: 'report' };
  },
};
