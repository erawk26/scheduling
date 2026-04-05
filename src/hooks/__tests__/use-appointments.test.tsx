import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const { app: mockApp } = vi.hoisted(() => {
  function createCollection(name: string) {
    let docs: any[] = [];
    return {
      _raw() { return docs; },
      findMany(filter?: any) {
        return Promise.resolve(docs.filter(
          (d) => !d._deleted && (!filter || Object.entries(filter).every(([k, v]) => d[k as keyof typeof d] === v))
        ));
      },
      async create(data: any) {
        const doc = { ...data, _id: data.id ?? name + '-' + Date.now(), _collection: name, _updatedAt: new Date().toISOString(), _deleted: false };
        docs.push(doc);
        return doc;
      },
      async update(id: string, data: any) {
        const idx = docs.findIndex((d) => d.id === id && !d._deleted);
        if (idx === -1) return null;
        docs[idx] = { ...docs[idx], ...data, _updatedAt: new Date().toISOString() };
        return docs[idx];
      },
      async delete(id: string) {
        const idx = docs.findIndex((d) => d.id === id && !d._deleted);
        if (idx === -1) return false;
        docs[idx] = { ...docs[idx], _deleted: true, _updatedAt: new Date().toISOString() };
        return true;
      },
      _reset() { docs = []; },
    };
  }

  const appointments = createCollection('appointments');
  const clients = createCollection('clients');
  return { app: { appointments, clients } };
});

vi.mock('@/lib/offlinekit', () => ({ app: mockApp }));

vi.mock('@erawk26/localkit/react', () => ({
  useCollection: vi.fn().mockImplementation((collection: any) => ({
    data: collection._raw().filter((d: any) => !d.deleted),
    isLoading: false,
    error: null,
  })),
}));

vi.mock('@/lib/graphhopper/geocode', () => ({
  geocodeAddress: vi.fn().mockResolvedValue({ lat: 40.7128, lon: -74.006 }),
}));

import { useAppointments, useCreateAppointment, useUpdateAppointment, useDeleteAppointment } from '../use-appointments';
import type { AppointmentFormData } from '@/lib/validations';

function wc() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useAppointments', () => {
  beforeEach(() => { mockApp.appointments._reset(); });

  it('returns all non-deleted appointments sorted by start_time', async () => {
    const now = new Date().toISOString();
    mockApp.appointments.create({
      id: 'apt1', client_id: 'c1', service_id: 's1', start_time: '2026-04-09T09:00:00',
      end_time: '2026-04-09T10:00:00', status: 'pending', location_type: 'clinic',
      address: null, latitude: null, longitude: null, notes: null, internal_notes: null,
      weather_alert: 0, created_at: now, updated_at: now, deleted_at: null,
    });
    mockApp.appointments.create({
      id: 'apt2', client_id: 'c2', service_id: 's2', start_time: '2026-04-10T10:00:00',
      end_time: '2026-04-10T11:00:00', status: 'confirmed', location_type: 'home',
      address: null, latitude: null, longitude: null, notes: null, internal_notes: null,
      weather_alert: 0, created_at: now, updated_at: now, deleted_at: null,
    });

    const { result } = renderHook(() => useAppointments(), { wrapper: wc() });
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].id).toBe('apt1');
    expect(result.current.data![1].id).toBe('apt2');
  });
});

describe('useCreateAppointment', () => {
  beforeEach(() => { mockApp.appointments._reset(); });

  it('creates appointment with required fields', async () => {
    const { result } = renderHook(() => useCreateAppointment(), { wrapper: wc() });

    const input: AppointmentFormData = {
      client_id: 'c1', service_id: 's1', start_time: '2026-04-10T09:00:00',
      end_time: '2026-04-10T10:00:00', status: 'confirmed', location_type: 'home',
      address: null, notes: '', internal_notes: '',
    };

    let created: any;
    await act(async () => { created = await result.current.mutateAsync(input); });

    expect(created?.client_id).toBe('c1');
    expect(created?.service_id).toBe('s1');
    expect(created?.status).toBe('confirmed');
    expect(created!.weather_alert).toBe(0);
  });
});

describe('useUpdateAppointment', () => {
  beforeEach(() => { mockApp.appointments._reset(); });

  it('updates specified fields', async () => {
    const now = new Date().toISOString();
    mockApp.appointments.create({
      id: 'upd-apt', client_id: 'c1', service_id: 's1',
      start_time: '2026-04-10T09:00:00', end_time: '2026-04-10T10:00:00',
      status: 'confirmed', location_type: 'home', address: null, notes: null,
      internal_notes: null, weather_alert: 0, created_at: now, updated_at: now, deleted_at: null,
    });

    const { result } = renderHook(() => useUpdateAppointment(), { wrapper: wc() });

    await act(async () => {
      await result.current.mutateAsync({ id: 'upd-apt', data: { status: 'cancelled', notes: 'Cancelled' } });
    });

    const all = await mockApp.appointments.findMany();
    const updated = all.find((a: any) => a.id === 'upd-apt');
    expect(updated!.status).toBe('cancelled');
    expect(updated!.notes).toBe('Cancelled');
  });
});

describe('useDeleteAppointment', () => {
  beforeEach(() => { mockApp.appointments._reset(); });

  it('deletes an appointment', async () => {
    await mockApp.appointments.create({
      id: 'del-apt', client_id: 'c1', service_id: 's1',
      start_time: '2026-04-10T09:00:00', end_time: '2026-04-10T10:00:00',
      status: 'confirmed', location_type: 'home', address: null, notes: null,
      internal_notes: null, weather_alert: 0, created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    });

    const { result } = renderHook(() => useDeleteAppointment(), { wrapper: wc() });

    await act(async () => { await result.current.mutateAsync('del-apt'); });

    const all = await mockApp.appointments.findMany();
    expect(all.find((a: any) => a.id === 'del-apt')).toBeUndefined();
  });
});
