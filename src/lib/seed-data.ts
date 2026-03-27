/**
 * Seed demo data into OfflineKit for testing.
 * Runs client-side (IndexedDB). Call once from a UI button.
 *
 * All seeded records use deterministic UUID prefixes so they can
 * be identified and removed without affecting real user data:
 *   10000000-... = services
 *   20000000-... = clients
 *   30000000-... = pets
 *   40000000-... = appointments
 *   50000000-... = agent profile sections
 */

import { app } from '@/lib/offlinekit';
import { addDays, addHours, setHours, setMinutes } from 'date-fns';

const USER_ID = '00000000-0000-0000-0000-000000000000';
const SEED_PREFIXES = ['10000000-', '20000000-', '30000000-', '40000000-', '50000000-'];

function ts(date: Date): string {
  return date.toISOString();
}

function meta(id: string) {
  const now = new Date().toISOString();
  return {
    id,
    user_id: USER_ID,
    created_at: now,
    updated_at: now,
    version: 1,
    synced_at: null,
    deleted_at: null,
    needs_sync: 0,
    sync_operation: null,
  } as const;
}

const SERVICES = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Full Groom', description: 'Bath, haircut, nails, ears', duration_minutes: 90, price_cents: 8500, weather_dependent: false, location_type: 'mobile' },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Bath & Brush', description: 'Bath, blow dry, brush out', duration_minutes: 60, price_cents: 5500, weather_dependent: false, location_type: 'mobile' },
  { id: '10000000-0000-4000-8000-000000000003', name: 'Nail Trim', description: 'Nail clipping and filing', duration_minutes: 20, price_cents: 2000, weather_dependent: false, location_type: 'mobile' },
  { id: '10000000-0000-4000-8000-000000000004', name: 'De-shed Treatment', description: 'Undercoat removal and de-shedding', duration_minutes: 75, price_cents: 7500, weather_dependent: true, location_type: 'mobile' },
];

const CLIENTS = [
  { id: '20000000-0000-4000-8000-000000000001', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah.j@email.com', phone: '555-867-5309', address: '456 Oak Ave, Portland, OR 97201', latitude: 45.5231, longitude: -122.6765, scheduling_flexibility: 'flexible' as const, notes: 'Prefers morning appointments. Has a fenced backyard.' },
  { id: '20000000-0000-4000-8000-000000000002', first_name: 'Mike', last_name: 'Chen', email: 'mike.chen@email.com', phone: '555-234-5678', address: '1200 NW 23rd Ave, Portland, OR 97210', latitude: 45.5328, longitude: -122.6985, scheduling_flexibility: 'fixed' as const, notes: 'Only available Tuesdays and Thursdays before noon.' },
  { id: '20000000-0000-4000-8000-000000000003', first_name: 'Emily', last_name: 'Rodriguez', email: 'emily.r@email.com', phone: '555-345-6789', address: '3400 SE Hawthorne Blvd, Portland, OR 97214', latitude: 45.5118, longitude: -122.6267, scheduling_flexibility: 'flexible' as const, notes: 'Works from home. Flexible on timing.' },
  { id: '20000000-0000-4000-8000-000000000004', first_name: 'David', last_name: 'Kim', email: 'david.kim@email.com', phone: '555-456-7890', address: '7890 N Mississippi Ave, Portland, OR 97217', latitude: 45.5571, longitude: -122.6759, scheduling_flexibility: 'unknown' as const, notes: null },
  { id: '20000000-0000-4000-8000-000000000005', first_name: 'Lisa', last_name: 'Martinez', email: 'lisa.m@email.com', phone: '555-567-8901', address: '2100 NE Alberta St, Portland, OR 97211', latitude: 45.5590, longitude: -122.6437, scheduling_flexibility: 'flexible' as const, notes: 'Two large dogs — needs extra time between appointments.' },
];

const PETS = [
  { id: '30000000-0000-4000-8000-000000000001', client_id: '20000000-0000-4000-8000-000000000001', name: 'Biscuit', species: 'dog', breed: 'Golden Retriever', size: 'large', age_years: 4, weight_lbs: 70, behavior_notes: 'Very friendly, loves water', medical_notes: null },
  { id: '30000000-0000-4000-8000-000000000002', client_id: '20000000-0000-4000-8000-000000000001', name: 'Mochi', species: 'dog', breed: 'Shih Tzu', size: 'small', age_years: 6, weight_lbs: 12, behavior_notes: 'Nervous around clippers', medical_notes: 'Sensitive skin — use hypoallergenic shampoo' },
  { id: '30000000-0000-4000-8000-000000000003', client_id: '20000000-0000-4000-8000-000000000002', name: 'Zeus', species: 'dog', breed: 'German Shepherd', size: 'large', age_years: 3, weight_lbs: 85, behavior_notes: 'Protective at first, warms up quickly', medical_notes: null },
  { id: '30000000-0000-4000-8000-000000000004', client_id: '20000000-0000-4000-8000-000000000003', name: 'Pepper', species: 'dog', breed: 'Australian Shepherd', size: 'medium', age_years: 2, weight_lbs: 45, behavior_notes: 'High energy, bring treats', medical_notes: null },
  { id: '30000000-0000-4000-8000-000000000005', client_id: '20000000-0000-4000-8000-000000000003', name: 'Olive', species: 'dog', breed: 'Dachshund', size: 'small', age_years: 8, weight_lbs: 15, behavior_notes: 'Calm senior dog', medical_notes: 'Arthritis — gentle handling' },
  { id: '30000000-0000-4000-8000-000000000006', client_id: '20000000-0000-4000-8000-000000000004', name: 'Max', species: 'dog', breed: 'Labrador Retriever', size: 'large', age_years: 5, weight_lbs: 75, behavior_notes: 'Loves everyone', medical_notes: null },
  { id: '30000000-0000-4000-8000-000000000007', client_id: '20000000-0000-4000-8000-000000000005', name: 'Bear', species: 'dog', breed: 'Bernese Mountain Dog', size: 'large', age_years: 3, weight_lbs: 100, behavior_notes: 'Gentle giant, drools a lot', medical_notes: null },
  { id: '30000000-0000-4000-8000-000000000008', client_id: '20000000-0000-4000-8000-000000000005', name: 'Luna', species: 'dog', breed: 'Husky', size: 'large', age_years: 4, weight_lbs: 55, behavior_notes: 'Vocal, sheds heavily', medical_notes: null },
];

function generateAppointments(): Array<Record<string, unknown>> {
  const now = new Date();
  const monday = addDays(now, (1 - now.getDay() + 7) % 7 || 7); // Next Monday

  const appointments = [
    // Week 1
    { id: '40000000-0000-4000-8000-000000000001', client_id: '20000000-0000-4000-8000-000000000001', pet_id: '30000000-0000-4000-8000-000000000001', service_id: '10000000-0000-4000-8000-000000000001', day: 0, hour: 9, status: 'scheduled' },
    { id: '40000000-0000-4000-8000-000000000002', client_id: '20000000-0000-4000-8000-000000000002', pet_id: '30000000-0000-4000-8000-000000000003', service_id: '10000000-0000-4000-8000-000000000001', day: 0, hour: 11, status: 'scheduled' },
    { id: '40000000-0000-4000-8000-000000000003', client_id: '20000000-0000-4000-8000-000000000003', pet_id: '30000000-0000-4000-8000-000000000004', service_id: '10000000-0000-4000-8000-000000000002', day: 1, hour: 9, status: 'scheduled' },
    { id: '40000000-0000-4000-8000-000000000004', client_id: '20000000-0000-4000-8000-000000000003', pet_id: '30000000-0000-4000-8000-000000000005', service_id: '10000000-0000-4000-8000-000000000003', day: 1, hour: 10, status: 'scheduled' },
    { id: '40000000-0000-4000-8000-000000000005', client_id: '20000000-0000-4000-8000-000000000004', pet_id: '30000000-0000-4000-8000-000000000006', service_id: '10000000-0000-4000-8000-000000000004', day: 2, hour: 10, status: 'scheduled' },
    { id: '40000000-0000-4000-8000-000000000006', client_id: '20000000-0000-4000-8000-000000000005', pet_id: '30000000-0000-4000-8000-000000000007', service_id: '10000000-0000-4000-8000-000000000001', day: 2, hour: 13, status: 'scheduled' },
    { id: '40000000-0000-4000-8000-000000000007', client_id: '20000000-0000-4000-8000-000000000005', pet_id: '30000000-0000-4000-8000-000000000008', service_id: '10000000-0000-4000-8000-000000000004', day: 3, hour: 9, status: 'scheduled' },
    { id: '40000000-0000-4000-8000-000000000008', client_id: '20000000-0000-4000-8000-000000000001', pet_id: '30000000-0000-4000-8000-000000000002', service_id: '10000000-0000-4000-8000-000000000002', day: 3, hour: 11, status: 'scheduled' },
    { id: '40000000-0000-4000-8000-000000000009', client_id: '20000000-0000-4000-8000-000000000002', pet_id: '30000000-0000-4000-8000-000000000003', service_id: '10000000-0000-4000-8000-000000000003', day: 4, hour: 9, status: 'scheduled' },
    // Week 2
    { id: '40000000-0000-4000-8000-000000000010', client_id: '20000000-0000-4000-8000-000000000003', pet_id: '30000000-0000-4000-8000-000000000004', service_id: '10000000-0000-4000-8000-000000000001', day: 7, hour: 9, status: 'draft' },
    { id: '40000000-0000-4000-8000-000000000011', client_id: '20000000-0000-4000-8000-000000000004', pet_id: '30000000-0000-4000-8000-000000000006', service_id: '10000000-0000-4000-8000-000000000002', day: 7, hour: 11, status: 'draft' },
    { id: '40000000-0000-4000-8000-000000000012', client_id: '20000000-0000-4000-8000-000000000005', pet_id: '30000000-0000-4000-8000-000000000007', service_id: '10000000-0000-4000-8000-000000000001', day: 8, hour: 10, status: 'draft' },
    { id: '40000000-0000-4000-8000-000000000013', client_id: '20000000-0000-4000-8000-000000000001', pet_id: '30000000-0000-4000-8000-000000000001', service_id: '10000000-0000-4000-8000-000000000004', day: 9, hour: 9, status: 'draft' },
  ];

  const svcDurations: Record<string, number> = {
    '10000000-0000-4000-8000-000000000001': 90, '10000000-0000-4000-8000-000000000002': 60, '10000000-0000-4000-8000-000000000003': 20, '10000000-0000-4000-8000-000000000004': 75,
  };

  const clientAddresses: Record<string, { address: string; lat: number; lng: number }> = {
    '20000000-0000-4000-8000-000000000001': { address: '456 Oak Ave, Portland, OR 97201', lat: 45.5231, lng: -122.6765 },
    '20000000-0000-4000-8000-000000000002': { address: '1200 NW 23rd Ave, Portland, OR 97210', lat: 45.5328, lng: -122.6985 },
    '20000000-0000-4000-8000-000000000003': { address: '3400 SE Hawthorne Blvd, Portland, OR 97214', lat: 45.5118, lng: -122.6267 },
    '20000000-0000-4000-8000-000000000004': { address: '7890 N Mississippi Ave, Portland, OR 97217', lat: 45.5571, lng: -122.6759 },
    '20000000-0000-4000-8000-000000000005': { address: '2100 NE Alberta St, Portland, OR 97211', lat: 45.5590, lng: -122.6437 },
  };

  return appointments.map((apt) => {
    const startDate = setMinutes(setHours(addDays(monday, apt.day), apt.hour), 0);
    const duration = svcDurations[apt.service_id] ?? 60;
    const endDate = addHours(startDate, duration / 60);
    const loc = clientAddresses[apt.client_id]!;

    return {
      ...meta(apt.id),
      client_id: apt.client_id,
      pet_id: apt.pet_id,
      service_id: apt.service_id,
      start_time: ts(startDate),
      end_time: ts(endDate),
      status: apt.status,
      location_type: 'mobile',
      address: loc.address,
      latitude: loc.lat,
      longitude: loc.lng,
      notes: null,
      internal_notes: null,
      weather_alert: 0,
    };
  });
}

const BOOTSTRAP_PROFILE = [
  { id: '50000000-0000-4000-8000-000000000001', section_id: 'bootstrap', content: { preferredName: 'Erik', businessType: 'Mobile dog grooming', completed: true } },
  { id: '50000000-0000-4000-8000-000000000002', section_id: 'work-schedule', content: { workDays: 'Monday through Friday', workHours: '8am to 5pm' } },
  { id: '50000000-0000-4000-8000-000000000003', section_id: 'service-area', content: { areas: 'Portland metro area, about 30 miles' } },
  { id: '50000000-0000-4000-8000-000000000004', section_id: 'travel-rules', content: { maxDriveTime: '30 minutes max' } },
  { id: '50000000-0000-4000-8000-000000000005', section_id: 'priorities', content: { topPriority: 'Cluster by area, then minimize driving' } },
];

function isSeedRecord(doc: { id?: string; _id?: string }): boolean {
  const id = doc.id ?? '';
  return SEED_PREFIXES.some((p) => id.startsWith(p));
}

type WithMeta = { _id: string; _deleted?: boolean; id?: string };

/**
 * Remove all seeded demo records (identified by UUID prefix).
 * Safe to call even if no seed data exists.
 */
export async function clearDemoData(): Promise<number> {
  let removed = 0;

  const collections = [
    app.services, app.clients, app.pets, app.appointments, app.agentProfile,
  ];

  for (const col of collections) {
    const all = await col.findMany() as WithMeta[];
    for (const doc of all) {
      if (!doc._deleted && isSeedRecord(doc)) {
        await col.delete(doc._id);
        removed++;
      }
    }
  }

  return removed;
}

export async function seedDemoData(): Promise<{ counts: Record<string, number> }> {
  // Clear any existing seed data first (idempotent)
  await clearDemoData();

  const counts: Record<string, number> = {};

  // Services
  for (const svc of SERVICES) {
    await app.services.create({ ...meta(svc.id), ...svc });
  }
  counts.services = SERVICES.length;

  // Clients
  for (const cli of CLIENTS) {
    await app.clients.create({ ...meta(cli.id), ...cli });
  }
  counts.clients = CLIENTS.length;

  // Pets
  for (const pet of PETS) {
    await app.pets.create({ ...meta(pet.id), ...pet });
  }
  counts.pets = PETS.length;

  // Appointments
  const appointments = generateAppointments();
  for (const apt of appointments) {
    await app.appointments.create(apt as Parameters<typeof app.appointments.create>[0]);
  }
  counts.appointments = appointments.length;

  // Agent Profile
  for (const prof of BOOTSTRAP_PROFILE) {
    await app.agentProfile.create({ ...meta(prof.id), section_id: prof.section_id as 'bootstrap' | 'work-schedule' | 'service-area' | 'travel-rules' | 'priorities', content: prof.content });
  }
  counts.profileSections = BOOTSTRAP_PROFILE.length;

  return { counts };
}
