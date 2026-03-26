/**
 * Build-Schedule skill: "Build my schedule for next week" / "Plan my week"
 * L2 skill — reads all 4 context types, calls weather API, writes draft appointments.
 */

import { app } from '@/lib/offlinekit';
import { sendMessage } from '@/lib/agent/openrouter-client';
import { fetchWeatherForecast } from '@/lib/weather/service';
import type { WithMeta } from 'mpb-localkit';
import type { Service } from '@/lib/offlinekit/schema';
import type {
  ContextProvider,
  ScheduleContext,
  ClientContext,
  ProfileContext,
  NotesContext,
} from '@/lib/agent/context';
import type { WeatherForecast } from '@/lib/weather/types';
import type { ChatMessage } from '@/lib/agent/types';
import type { Skill, SkillResult, SkillExecuteOptions } from './types';

function getNextWeekRange(): { from: string; to: string } {
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

function extractCoords(profile: ProfileContext): { lat: number; lon: number } | null {
  const section = profile.sections.find((s) => s.section_id === 'service-area');
  if (!section) return null;
  const c = section.content as Record<string, unknown>;
  const lat = typeof c['lat'] === 'number' ? c['lat'] : typeof c['latitude'] === 'number' ? c['latitude'] : null;
  const lon = typeof c['lon'] === 'number' ? c['lon'] : typeof c['longitude'] === 'number' ? c['longitude'] : null;
  if (lat === null || lon === null) return null;
  return { lat: lat as number, lon: lon as number };
}

function buildSystemPrompt(
  profile: ProfileContext,
  clients: ClientContext,
  notes: NotesContext,
  existing: ScheduleContext,
  services: WithMeta<Service>[],
  weather: WeatherForecast[] | null,
  weekRange: { from: string; to: string }
): string {
  const profileSections = Object.fromEntries(
    profile.sections.map((s) => [s.section_id, s.content])
  );

  const clientLines = clients.clients
    .map(
      (c) =>
        `  {"client_id":"${c.id}","name":"${c.first_name} ${c.last_name}","flexibility":"${c.scheduling_flexibility}","address":${JSON.stringify(c.address ?? null)}${c.notes ? `,"notes":${JSON.stringify(c.notes)}` : ''}}`
    )
    .join(',\n');

  const serviceLines = services
    .map(
      (s) =>
        `  {"service_id":"${s.id}","name":${JSON.stringify(s.name)},"duration_minutes":${s.duration_minutes},"weather_dependent":${s.weather_dependent}}`
    )
    .join(',\n');

  const existingLines =
    existing.appointments.length > 0
      ? existing.appointments
          .map((a) => `  - ${a.start_time}: ${a.clientName} — ${a.serviceName} [${a.status}]`)
          .join('\n')
      : '  None';

  const noteLines =
    notes.notes.length > 0
      ? notes.notes
          .map((n) => `  [${n.date_ref ?? 'general'}] ${n.summary}${n.content ? `: ${n.content}` : ''}`)
          .join('\n')
      : '  None';

  const weatherLines = weather
    ? weather
        .map(
          (w) =>
            `  ${w.date}: ${w.condition_label}, high ${w.temp_high_f}°F, rain ${w.precip_probability}%, wind ${w.wind_speed_mph}mph — outdoor suitable: ${w.is_outdoor_suitable}`
        )
        .join('\n')
    : '  Weather data unavailable — assume outdoor-suitable for all days';

  const weekStart = weekRange.from.slice(0, 10);
  const exampleStart = `${weekStart}T09:00:00`;

  return `You are an expert scheduling assistant for a mobile pet service professional.
Build a complete draft schedule for the week of ${weekStart} to ${weekRange.to.slice(0, 10)}.

## BUSINESS PROFILE
${JSON.stringify(profileSections, null, 2)}

## CLIENTS
[
${clientLines}
]

## SERVICES
[
${serviceLines}
]

## EXISTING APPOINTMENTS THIS WEEK (do not duplicate these)
${existingLines}

## ACCUMULATED SCHEDULING NOTES
${noteLines}

## WEATHER FORECAST
${weatherLines}

## SCHEDULING RULES
1. Respect work schedule (days, hours, breaks) from the profile's work-schedule section
2. Honor client scheduling_flexibility: "fixed" = keep their preferred time, "flexible" or "unknown" = optimize freely
3. Group clients by geographic proximity per day to minimize drive time
4. For weather_dependent services: do not schedule on days where outdoor suitable is false
5. Respect personal-commitments (blocked times) from the profile
6. Apply business-rules from the profile (appointment spacing, back-to-back limits, etc.)
7. Use accumulated notes to inform client preferences and service history
8. All generated appointments must have status "draft"

## OUTPUT FORMAT
Respond with a JSON array inside \`\`\`json fences, followed by a brief 2-3 sentence friendly summary.
Use EXACT client_id and service_id values from the lists above — do NOT invent IDs.
Each appointment object must have exactly these fields:
{
  "client_id": "<exact uuid from CLIENTS list>",
  "service_id": "<exact uuid from SERVICES list>",
  "start_time": "<ISO 8601 datetime, e.g. ${exampleStart}>",
  "end_time": "<ISO 8601 datetime>",
  "location_type": "mobile",
  "address": "<client address string or null>",
  "notes": "<scheduling note or null>"
}`;
}

interface DraftInput {
  client_id: string;
  service_id: string;
  start_time: string;
  end_time: string;
  location_type: string;
  address?: string | null;
  notes?: string | null;
}

function parseDrafts(content: string): DraftInput[] | null {
  const match = content.match(/```json\s*([\s\S]*?)```/);
  if (!match?.[1]) return null;
  try {
    const parsed = JSON.parse(match[1].trim());
    if (!Array.isArray(parsed)) return null;
    return parsed as DraftInput[];
  } catch {
    return null;
  }
}

async function writeDrafts(drafts: DraftInput[]): Promise<number> {
  const now = new Date().toISOString();
  let written = 0;
  for (const draft of drafts) {
    if (!draft.client_id || !draft.service_id || !draft.start_time || !draft.end_time) continue;
    try {
      await app.appointments.create({
        id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
        client_id: draft.client_id,
        pet_id: null,
        service_id: draft.service_id,
        start_time: draft.start_time,
        end_time: draft.end_time,
        status: 'draft',
        location_type: draft.location_type ?? 'mobile',
        address: draft.address ?? null,
        latitude: null,
        longitude: null,
        notes: draft.notes ?? null,
        internal_notes: null,
        weather_alert: 0,
        created_at: now,
        updated_at: now,
        version: 1,
        synced_at: null,
        deleted_at: null,
        needs_sync: 1,
        sync_operation: 'INSERT',
      });
      written++;
    } catch {
      // Skip invalid entries, continue writing the rest
    }
  }
  return written;
}

export const buildScheduleSkill: Skill = {
  name: 'build-schedule',
  description: 'Builds a draft weekly schedule from context, constraints, weather, and routes',
  tier: 'L2',
  contextRequirements: ['getScheduleContext', 'getClientContext', 'getProfileContext', 'getNotesContext'],
  writeActions: ['appointments'],
  piiLevel: 'full',

  async execute(
    contextProvider: ContextProvider,
    userMessage: string,
    options: SkillExecuteOptions = {}
  ): Promise<SkillResult> {
    const weekRange = getNextWeekRange();

    const [schedule, clients, profile, notes, allServices] = await Promise.all([
      contextProvider.getScheduleContext(weekRange),
      contextProvider.getClientContext(),
      contextProvider.getProfileContext(),
      contextProvider.getNotesContext(),
      app.services.findMany() as unknown as Promise<WithMeta<Service>[]>,
    ]);

    const coords = extractCoords(profile);
    const weather = coords ? await fetchWeatherForecast(coords.lat, coords.lon) : null;

    const systemPrompt = buildSystemPrompt(
      profile, clients, notes, schedule, allServices, weather, weekRange
    );

    const messages: ChatMessage[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userMessage },
    ];

    const response = await sendMessage(messages, {
      ...options.openrouterOptions,
      maxTokens: 4000,
      temperature: 0.3,
    });

    const drafts = parseDrafts(response.content);
    if (!drafts) {
      return {
        response: {
          ...response,
          content: `I had trouble generating a structured schedule. Please try again or share more details about your week.\n\n${response.content}`,
        },
        skillName: 'build-schedule',
      };
    }

    const written = await writeDrafts(drafts);
    const summary = response.content.replace(/```json[\s\S]*?```/, '').trim();
    const header = `Created ${written} draft appointment${written === 1 ? '' : 's'} for the week of ${weekRange.from.slice(0, 10)}. Review them in your schedule and confirm when ready.\n\n`;

    return {
      response: { ...response, content: header + summary },
      skillName: 'build-schedule',
    };
  },
};
