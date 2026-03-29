import { app } from '@/lib/offlinekit';
import type { WithMeta } from '@erawk26/localkit';
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
import type { AgentSearchIndex } from '@/lib/search/search-index';
import type { CollectionName, SearchResult } from '@/lib/search/types';
import type {
  Appointment,
  Client,
  Pet,
  Service,
  AgentNote,
  AgentProfile,
} from '@/lib/offlinekit/schema';

type WM<T> = WithMeta<T>;

export class TieredContextProvider implements ContextProvider {
  private searchIndex: AgentSearchIndex;

  constructor(searchIndex: AgentSearchIndex) {
    this.searchIndex = searchIndex;
  }

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

  private getRecentDateRange(): DateRange {
    const now = new Date();
    const from = new Date(now);
    from.setDate(now.getDate() - 7);
    const to = new Date(now);
    to.setDate(now.getDate() + 7);
    return {
      from: from.toISOString().replace('Z', '').split('.')[0]!,
      to: to.toISOString().replace('Z', '').split('.')[0]!,
    };
  }

  private async hydrateSearchResults(
    results: SearchResult[],
    l0AppointmentIds: Set<string>,
  ): Promise<{ schedule?: ScheduleContext; clients?: ClientContext; notes?: NotesContext }> {
    const byCollection = new Map<CollectionName, string[]>();
    for (const r of results) {
      const list = byCollection.get(r.collection) ?? [];
      list.push(r.id);
      byCollection.set(r.collection, list);
    }

    const aptIds = (byCollection.get('appointments') ?? []).filter((id) => !l0AppointmentIds.has(id));
    const clientIds = byCollection.get('clients') ?? [];
    const noteIds = byCollection.get('agentNotes') ?? [];
    const petIds = byCollection.get('pets') ?? [];

    const clientIdsFromPets: string[] = [];

    const hydratedContext: { schedule?: ScheduleContext; clients?: ClientContext; notes?: NotesContext } = {};

    const fetchTasks: Promise<void>[] = [];

    if (aptIds.length > 0) {
      fetchTasks.push(
        Promise.all([
          app.appointments.findMany() as unknown as Promise<WM<Appointment>[]>,
          app.clients.findMany() as unknown as Promise<WM<Client>[]>,
          app.services.findMany() as unknown as Promise<WM<Service>[]>,
        ]).then(([allApts, allClients, allServices]) => {
          const filtered = allApts.filter((a) => aptIds.includes(a.id));
          const clientMap = new Map(allClients.map((c) => [c.id, c]));
          const serviceMap = new Map(allServices.map((s) => [s.id, s]));
          const summaries: AppointmentSummary[] = filtered.map((apt) => {
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
          hydratedContext.schedule = {
            dateRange: { from: summaries[0]?.start_time ?? '', to: summaries[summaries.length - 1]?.start_time ?? '' },
            appointments: summaries,
          };
        })
      );
    }

    const allClientIds = [...clientIds];
    if (petIds.length > 0) {
      fetchTasks.push(
        (app.pets.findMany() as unknown as Promise<WM<Pet>[]>).then((allPets) => {
          const matchedPets = allPets.filter((p) => petIds.includes(p.id));
          for (const pet of matchedPets) {
            if (!allClientIds.includes(pet.client_id)) {
              clientIdsFromPets.push(pet.client_id);
            }
          }
        })
      );
    }

    await Promise.all(fetchTasks);

    const mergedClientIds = [...allClientIds, ...clientIdsFromPets];
    if (mergedClientIds.length > 0) {
      const [allClients, allPets] = await Promise.all([
        app.clients.findMany() as unknown as WM<Client>[],
        app.pets.findMany() as unknown as WM<Pet>[],
      ]);
      const clients = allClients.filter((c) => mergedClientIds.includes(c.id));
      const petsByClientId = new Map<string, WM<Pet>[]>();
      for (const pet of allPets) {
        const list = petsByClientId.get(pet.client_id) ?? [];
        list.push(pet);
        petsByClientId.set(pet.client_id, list);
      }
      const summaries: ClientSummary[] = clients.map((c) => ({
        id: c.id,
        first_name: c.first_name,
        last_name: c.last_name,
        email: c.email ?? null,
        phone: c.phone ?? null,
        address: c.address ?? null,
        scheduling_flexibility: c.scheduling_flexibility,
        notes: c.notes ?? null,
        pets: (petsByClientId.get(c.id) ?? []).map((p) => ({
          id: p.id,
          name: p.name,
          species: p.species,
          breed: p.breed ?? null,
          behavior_notes: p.behavior_notes ?? null,
        })),
      }));
      hydratedContext.clients = { clients: summaries };
    }

    if (noteIds.length > 0) {
      const allNotes = await app.agentNotes.findMany() as unknown as WM<AgentNote>[];
      const filtered = allNotes.filter((n) => noteIds.includes(n.id));
      hydratedContext.notes = {
        notes: filtered.map((n) => ({
          id: n.id,
          summary: n.summary,
          content: n.content ?? null,
          tags: n.tags,
          date_ref: n.date_ref ?? null,
          client_id: n.client_id ?? null,
        })),
      };
    }

    return hydratedContext;
  }

  async getFullContext(query: string): Promise<AgentContext> {
    const recentRange = this.getRecentDateRange();

    // L0: Always include profile and recent schedule
    const [profile, recentSchedule] = await Promise.all([
      this.getProfileContext(),
      this.getScheduleContext(recentRange),
    ]);

    const l0AppointmentIds = new Set(recentSchedule.appointments.map((a) => a.id));

    // L1: BM25 search — offline, <1ms
    const searchResults = this.searchIndex.search(query, { limit: 10 });
    const l1Context = searchResults.length > 0
      ? await this.hydrateSearchResults(searchResults, l0AppointmentIds)
      : {};

    // L2: Stub — returns L0+L1 (LLM re-ranking wired in US-004)
    const context: AgentContext = { query };
    context.profile = profile;
    context.schedule = l1Context.schedule
      ? { dateRange: recentRange, appointments: [...recentSchedule.appointments, ...l1Context.schedule.appointments] }
      : recentSchedule;

    if (l1Context.clients) context.clients = l1Context.clients;
    if (l1Context.notes) context.notes = l1Context.notes;

    return context;
  }
}
