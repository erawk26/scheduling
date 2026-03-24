import { app } from '@/lib/offlinekit';
import type { WithMeta } from 'mpb-localkit';
import type {
  ContextProvider,
  DateRange,
  ScheduleContext,
  ClientContext,
  ProfileContext,
  NotesContext,
  AgentContext,
  AppointmentSummary,
  ClientSummary,
  PetSummary,
  ProfileSection,
  NoteSummary,
} from './types';
import type {
  Appointment,
  Client,
  Pet,
  Service,
  AgentNote,
  AgentProfile,
} from '@/lib/offlinekit/schema';

type WM<T> = WithMeta<T>;

const SCHEDULE_KEYWORDS = ['schedule', 'week', 'day', 'appointment', 'time', 'when', 'today', 'tomorrow', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
const CLIENT_KEYWORDS = ['client', 'customer', 'pet', 'dog', 'cat', 'animal', 'owner'];
const PROFILE_KEYWORDS = ['profile', 'rule', 'setting', 'preference', 'travel', 'area', 'commitment', 'priority', 'business'];
const NOTE_KEYWORDS = ['note', 'history', 'remember', 'last time', 'previous', 'learned', 'pattern'];

export class StructuredContextProvider implements ContextProvider {
  async getScheduleContext(dateRange: DateRange): Promise<ScheduleContext> {
    const [allAppointments, allClients, allServices] = await Promise.all([
      app.appointments.findMany() as unknown as WM<Appointment>[],
      app.clients.findMany() as unknown as WM<Client>[],
      app.services.findMany() as unknown as WM<Service>[],
    ]);

    const appointments = allAppointments
      .filter((apt) => apt.start_time >= dateRange.from && apt.start_time <= dateRange.to)
      .sort((a, b) => a.start_time.localeCompare(b.start_time));

    const clientMap = new Map<string, WM<Client>>(allClients.map((c) => [c.id, c]));
    const serviceMap = new Map<string, WM<Service>>(allServices.map((s) => [s.id, s]));

    const summaries: AppointmentSummary[] = appointments.map((apt) => {
      const client = clientMap.get(apt.client_id);
      const service = serviceMap.get(apt.service_id);
      return {
        id: apt.id,
        start_time: apt.start_time,
        end_time: apt.end_time,
        status: apt.status,
        clientName: client ? `${client.first_name} ${client.last_name}` : 'Unknown',
        serviceName: service?.name ?? 'Unknown',
        address: apt.address ?? null,
        notes: apt.notes ?? null,
        weather_alert: apt.weather_alert,
      };
    });

    return { dateRange, appointments: summaries };
  }

  async getClientContext(clientId?: string): Promise<ClientContext> {
    const [allClients, allPets] = await Promise.all([
      app.clients.findMany() as unknown as WM<Client>[],
      app.pets.findMany() as unknown as WM<Pet>[],
    ]);

    const clients = clientId
      ? allClients.filter((c) => c.id === clientId)
      : allClients;

    const petsByClientId = new Map<string, WM<Pet>[]>();
    for (const pet of allPets) {
      const list = petsByClientId.get(pet.client_id) ?? [];
      list.push(pet);
      petsByClientId.set(pet.client_id, list);
    }

    const summaries: ClientSummary[] = clients.map((client) => {
      const pets: PetSummary[] = (petsByClientId.get(client.id) ?? []).map((pet) => ({
        id: pet.id,
        name: pet.name,
        species: pet.species,
        breed: pet.breed ?? null,
        behavior_notes: pet.behavior_notes ?? null,
      }));

      return {
        id: client.id,
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email ?? null,
        phone: client.phone ?? null,
        address: client.address ?? null,
        scheduling_flexibility: client.scheduling_flexibility,
        notes: client.notes ?? null,
        pets,
      };
    });

    return { clients: summaries };
  }

  async getProfileContext(sections?: string[]): Promise<ProfileContext> {
    const allProfiles = await app.agentProfile.findMany() as unknown as WM<AgentProfile>[];

    const filtered = sections && sections.length > 0
      ? allProfiles.filter((p) => sections.includes(p.section_id))
      : allProfiles;

    const result: ProfileSection[] = filtered.map((p) => ({
      section_id: p.section_id,
      content: p.content,
    }));

    return { sections: result };
  }

  async getNotesContext(dateRange?: DateRange, keywords?: string[]): Promise<NotesContext> {
    let notes = await app.agentNotes.findMany() as unknown as WM<AgentNote>[];

    if (dateRange) {
      notes = notes.filter((n) => {
        if (!n.date_ref) return false;
        return n.date_ref >= dateRange.from && n.date_ref <= dateRange.to;
      });
    }

    if (keywords && keywords.length > 0) {
      const lower = keywords.map((k) => k.toLowerCase());
      notes = notes.filter((n) => {
        const text = `${n.summary} ${n.content ?? ''}`.toLowerCase();
        return lower.some((kw) => text.includes(kw));
      });
    }

    const summaries: NoteSummary[] = notes.map((n) => ({
      id: n.id,
      summary: n.summary,
      content: n.content ?? null,
      tags: n.tags,
      date_ref: n.date_ref ?? null,
      client_id: n.client_id ?? null,
    }));

    return { notes: summaries };
  }

  async getFullContext(query: string): Promise<AgentContext> {
    const lower = query.toLowerCase();

    const needsSchedule = SCHEDULE_KEYWORDS.some((kw) => lower.includes(kw));
    const needsClients = CLIENT_KEYWORDS.some((kw) => lower.includes(kw));
    const needsProfile = PROFILE_KEYWORDS.some((kw) => lower.includes(kw));
    const needsNotes = NOTE_KEYWORDS.some((kw) => lower.includes(kw));

    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 6);

    const defaultRange: DateRange = {
      from: weekStart.toISOString(),
      to: weekEnd.toISOString(),
    };

    const [schedule, clients, profile, notes] = await Promise.all([
      needsSchedule ? this.getScheduleContext(defaultRange) : Promise.resolve(undefined),
      needsClients ? this.getClientContext() : Promise.resolve(undefined),
      needsProfile ? this.getProfileContext() : Promise.resolve(undefined),
      needsNotes ? this.getNotesContext() : Promise.resolve(undefined),
    ]);

    const context: AgentContext = { query };
    if (schedule) context.schedule = schedule;
    if (clients) context.clients = clients;
    if (profile) context.profile = profile;
    if (notes) context.notes = notes;

    return context;
  }
}
