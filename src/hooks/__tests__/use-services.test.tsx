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

  const services = createCollection('services');
  return { app: { services } };
});

vi.mock('@/lib/offlinekit', () => ({ app: mockApp }));

vi.mock('@erawk26/localkit/react', () => ({
  useCollection: vi.fn().mockImplementation((collection: any) => ({
    data: collection._raw().filter((d: any) => !d._deleted),
    isLoading: false,
    error: null,
  })),
}));

import { useServices, useCreateService, useUpdateService, useDeleteService } from '../use-services';
import type { ServiceFormData } from '@/lib/validations';

function wc() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useServices', () => {
  beforeEach(() => { mockApp.services._reset(); });

  it('returns all non-deleted services sorted by name', () => {
    mockApp.services.create({
      id: 's1', name: 'Grooming', description: 'Full groom', duration_minutes: 90,
      price_cents: 5000, weather_dependent: false, location_type: 'home',
      user_id: '00000000-0000-0000-0000-000000000000',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    });
    mockApp.services.create({
      id: 's2', name: 'Training', description: null, duration_minutes: 60,
      price_cents: 3000, weather_dependent: true, location_type: 'clinic',
      user_id: '00000000-0000-0000-0000-000000000000',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    });

    const { result } = renderHook(() => useServices(), { wrapper: wc() });
    expect(result.current.data).toHaveLength(2);
    expect(result.current.data![0].name).toBe('Grooming');
    expect(result.current.data![1].name).toBe('Training');
  });
});

describe('useCreateService', () => {
  beforeEach(() => { mockApp.services._reset(); });

  it('creates service with all fields', async () => {
    const { result } = renderHook(() => useCreateService(), { wrapper: wc() });
    const input: ServiceFormData = {
      name: 'New Service', description: 'A new service', duration_minutes: 45,
      price_cents: 2500, weather_dependent: true, location_type: 'clinic',
    };

    let created: any;
    await act(async () => { created = await result.current.mutateAsync(input); });

    expect(created?.name).toBe('New Service');
    expect(created!.duration_minutes).toBe(45);
    expect(created!.price_cents).toBe(2500);
    expect(created!.weather_dependent).toBe(true);
  });
});

describe('useUpdateService', () => {
  beforeEach(() => { mockApp.services._reset(); });

  it('updates fields', async () => {
    mockApp.services.create({
      id: 'upd-svc', name: 'Original', description: 'Original desc', duration_minutes: 60,
      price_cents: 3000, weather_dependent: false, location_type: 'home',
      user_id: '00000000-0000-0000-0000-000000000000',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    });

    const { result } = renderHook(() => useUpdateService(), { wrapper: wc() });

    await act(async () => {
      await result.current.mutateAsync({ id: 'upd-svc', data: { name: 'Updated', price_cents: 4500 } });
    });

    const all = await mockApp.services.findMany();
    const updated = all.find((s: any) => s.id === 'upd-svc');
    expect(updated!.name).toBe('Updated');
    expect(updated!.price_cents).toBe(4500);
  });
});

describe('useDeleteService', () => {
  beforeEach(() => { mockApp.services._reset(); });

  it('deletes a service', async () => {
    mockApp.services.create({
      id: 'del-svc', name: 'Delete Me', description: null, duration_minutes: 30,
      price_cents: 1500, weather_dependent: false, location_type: 'home',
      user_id: '00000000-0000-0000-0000-000000000000',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    });

    const { result } = renderHook(() => useDeleteService(), { wrapper: wc() });

    await act(async () => { await result.current.mutateAsync('del-svc'); });

    const all = await mockApp.services.findMany();
    expect(all.find((s: any) => s.id === 'del-svc')).toBeUndefined();
  });
});
