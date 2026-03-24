import { z } from 'zod';
import { collection } from 'mpb-localkit';

// Zod v4 type bridge — offlinekit#11 still open. collection() expects Zod v3 ZodObject.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const col = (schema: z.ZodObject<any>) => collection(schema as any);

// Base schema for all OfflineKit documents
const BaseDoc = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  created_at: z.string().datetime(),
  updated_at: z.string().datetime(),
  version: z.number().int().default(1),
  synced_at: z.string().datetime().nullable(),
  deleted_at: z.string().datetime().nullable(),
  needs_sync: z.number().int().default(0),
  sync_operation: z.enum(['INSERT', 'UPDATE', 'DELETE']).nullable(),
});

// Zod schemas for existing KE Agenda V3 entities
export const ClientSchema = BaseDoc.extend({
  first_name: z.string().min(1, 'First name is required'),
  last_name: z.string().min(1, 'Last name is required'),
  email: z.string().email().nullable().optional(),
  phone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  scheduling_flexibility: z.enum(['unknown', 'flexible', 'fixed']).default('unknown'),
});

export const PetSchema = BaseDoc.extend({
  client_id: z.string().uuid(),
  name: z.string().min(1, 'Pet name is required'),
  species: z.string().min(1, 'Species is required'),
  breed: z.string().nullable().optional(),
  size: z.string().nullable().optional(),
  age_years: z.number().int().min(0).nullable().optional(),
  weight_lbs: z.number().min(0).nullable().optional(),
  behavior_notes: z.string().nullable().optional(),
  medical_notes: z.string().nullable().optional(),
});

export const ServiceSchema = BaseDoc.extend({
  name: z.string().min(1, 'Service name is required'),
  description: z.string().nullable(),
  duration_minutes: z.number().int().min(1, 'Duration must be at least 1 minute'),
  price_cents: z.number().int().min(0, 'Price cannot be negative').nullable(),
  weather_dependent: z.boolean().default(false),
  location_type: z.string().min(1, 'Location type is required'),
});

export const AppointmentSchema = BaseDoc.extend({
  client_id: z.string().uuid(),
  pet_id: z.string().uuid().nullable().optional(),
  service_id: z.string().uuid(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  status: z.enum(['draft', 'pending', 'scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show']).default('scheduled'),
  location_type: z.string().min(1, 'Location type is required'),
  address: z.string().nullable().optional(),
  latitude: z.number().nullable().optional(),
  longitude: z.number().nullable().optional(),
  notes: z.string().nullable().optional(),
  internal_notes: z.string().nullable().optional(),
  weather_alert: z.number().int().default(0),
});

// Zod schemas for new collections based on implementation plan
export const BusinessProfileSchema = BaseDoc.extend({
  business_name: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  timezone: z.string().default('UTC'),
  service_area_miles: z.number().min(0).default(0),
  business_latitude: z.number().nullable().optional(),
  business_longitude: z.number().nullable().optional(),
});

export const AgentNoteSchema = BaseDoc.extend({
  summary: z.string(),
  content: z.string().nullable().optional(),
  tags: z.array(z.string()).default([]),
  date_ref: z.string().datetime().nullable().optional(),
  client_id: z.string().uuid().nullable().optional(),
});

export const AgentProfileSectionId = z.enum([
  'work-schedule', 'service-area', 'travel-rules', 'client-rules',
  'personal-commitments', 'business-rules', 'priorities'
]);

export const AgentProfileSchema = BaseDoc.extend({
  section_id: AgentProfileSectionId,
  content: z.record(z.string(), z.any()),
});

export const AgentMemorySchema = BaseDoc.extend({
  type: z.string(),
  payload: z.record(z.string(), z.any()),
});

export const AgentConversationSchema = BaseDoc.extend({
  channel: z.string(),
  message_id: z.string(),
  role: z.enum(['user', 'agent']),
  content: z.string(),
  timestamp: z.string().datetime(),
  status: z.enum(['sent', 'received', 'pending', 'error']).default('sent'),
  context: z.record(z.string(), z.any()).nullable().optional(),
});

// Wrap schemas with collection() for proper OfflineKit CollectionDescriptor typing
export const collections = {
  clients: col(ClientSchema),
  pets: col(PetSchema),
  services: col(ServiceSchema),
  appointments: col(AppointmentSchema),
  businessProfile: col(BusinessProfileSchema),
  agentNotes: col(AgentNoteSchema),
  agentProfile: col(AgentProfileSchema),
  agentMemories: col(AgentMemorySchema),
  agentConversations: col(AgentConversationSchema),
};

export type Client = z.infer<typeof ClientSchema>;
export type Pet = z.infer<typeof PetSchema>;
export type Service = z.infer<typeof ServiceSchema>;
export type Appointment = z.infer<typeof AppointmentSchema>;
export type BusinessProfile = z.infer<typeof BusinessProfileSchema>;
export type AgentNote = z.infer<typeof AgentNoteSchema>;
export type AgentProfile = z.infer<typeof AgentProfileSchema>;
export type AgentMemory = z.infer<typeof AgentMemorySchema>;
export type AgentConversation = z.infer<typeof AgentConversationSchema>;

export type Collections = typeof collections;
