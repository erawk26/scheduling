export interface DateRange {
  from: string; // ISO datetime string
  to: string;   // ISO datetime string
}

export interface AppointmentSummary {
  id: string;
  start_time: string;
  end_time: string;
  status: string;
  clientName: string;
  serviceName: string;
  address: string | null;
  notes: string | null;
  weather_alert: number;
}

export interface ScheduleContext {
  dateRange: DateRange;
  appointments: AppointmentSummary[];
}

export interface PetSummary {
  id: string;
  name: string;
  species: string;
  breed: string | null;
  behavior_notes: string | null;
}

export interface ClientSummary {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  scheduling_flexibility: 'unknown' | 'flexible' | 'fixed';
  notes: string | null;
  pets: PetSummary[];
}

export interface ClientContext {
  clients: ClientSummary[];
}

export interface ProfileSection {
  section_id: string;
  content: Record<string, unknown>;
}

export interface ProfileContext {
  sections: ProfileSection[];
}

export interface NoteSummary {
  id: string;
  summary: string;
  content: string | null;
  tags: string[];
  date_ref: string | null;
  client_id: string | null;
}

export interface NotesContext {
  notes: NoteSummary[];
}

export interface AgentContext {
  query: string;
  schedule?: ScheduleContext;
  clients?: ClientContext;
  profile?: ProfileContext;
  notes?: NotesContext;
}

export interface ContextProvider {
  getScheduleContext(dateRange: DateRange): Promise<ScheduleContext>;
  getClientContext(clientId?: string): Promise<ClientContext>;
  getProfileContext(sections?: string[]): Promise<ProfileContext>;
  getNotesContext(dateRange?: DateRange, keywords?: string[]): Promise<NotesContext>;
  getFullContext(query: string): Promise<AgentContext>;
}
