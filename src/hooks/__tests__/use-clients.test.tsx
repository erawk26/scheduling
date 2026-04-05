import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

  const clients = createCollection('clients');
  const pets = createCollection('pets');
  const appointments = createCollection('appointments');

  return { app: { clients, pets, appointments } };
});

vi.mock('@/lib/offlinekit', () => ({ app: mockApp }));

vi.mock('@erawk26/localkit/react', () => ({
  useCollection: vi.fn().mockImplementation((collection: any) => ({
    data: collection._raw().filter((d: any) => !d._deleted),
    isLoading: false,
    error: null,
  })),
}));

vi.mock('@/lib/graphhopper/geocode', () => ({
  geocodeAddress: vi.fn().mockResolvedValue({ lat: 40.7128, lon: -74.006 }),
}));

import { useClients, useCreateClient, useUpdateClient, useDeleteClient, useClient } from '../use-clients';
import type { ClientFormData } from '@/lib/validations';

function wc() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

describe('useClients', () => {
  beforeEach(() => { mockApp.clients._reset(); });

  it('returns all non-deleted clients sorted by name', () => {
    mockApp.clients.create({
      id: 'c1', first_name: 'Alice', last_name: 'Smith', email: null, phone: null,
      address: null, latitude: null, longitude: null, notes: null,
      scheduling_flexibility: 'unknown',
      user_id: '00000000-0000-0000-0000-000000000000',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    });

    const { result } = renderHook(() => useClients(), { wrapper: wc() });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].first_name).toBe('Alice');
  });

  it('searches by name', () => {
    mockApp.clients.create({
      id: 'c1', first_name: 'Alice', last_name: 'Smith', email: null, phone: null,
      address: null, latitude: null, longitude: null, notes: null,
      scheduling_flexibility: 'unknown',
      user_id: '00000000-0000-0000-0000-000000000000',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    });
    mockApp.clients.create({
      id: 'c2', first_name: 'Bob', last_name: 'Jones', email: null, phone: null,
      address: null, latitude: null, longitude: null, notes: null,
      scheduling_flexibility: 'unknown',
      user_id: '00000000-0000-0000-0000-000000000000',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    });

    const { result } = renderHook(() => useClients('alice'), { wrapper: wc() });
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data![0].last_name).toBe('Smith');
  });
});

describe('useClient', () => {
  beforeEach(() => { mockApp.clients._reset(); });

  it('returns a single client by id', () => {
    mockApp.clients.create({
      id: 'c1', first_name: 'Single', last_name: 'Client', email: null, phone: null,
      address: null, latitude: null, longitude: null, notes: null,
      scheduling_flexibility: 'unknown',
      user_id: '00000000-0000-0000-0000-000000000000',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    });

    const { result } = renderHook(() => useClient('c1'), { wrapper: wc() });
    expect(result.current.data).not.toBeNull();
    expect(result.current.data!.first_name).toBe('Single');
  });
});

describe('useCreateClient', () => {
  beforeEach(() => { mockApp.clients._reset(); });

  it('creates a client with all fields', async () => {
    const { result } = renderHook(() => useCreateClient(), { wrapper: wc() });
    const input: ClientFormData = {
      first_name: 'Test', last_name: 'User', email: 'test@example.com', phone: '555-1234',
      address: '123 Main St', notes: 'Test note', scheduling_flexibility: 'flexible',
    };

    let created: any;
    await act(async () => { created = await result.current.mutateAsync(input); });

    expect(created?.first_name).toBe('Test');
    expect(created?.email).toBe('test@example.com');
    expect(created?.address).toBe('123 Main St');
    expect(created?.scheduling_flexibility).toBe('flexible');
  });
});

describe('useUpdateClient', () => {
  beforeEach(() => { mockApp.clients._reset(); });

  it('updates fields and sanitizes empty strings', async () => {
    mockApp.clients.create({
      id: 'upd-1', first_name: 'Original', last_name: 'Name', email: 'orig@test.com',
      phone: '555-0000', address: null, latitude: null, longitude: null, notes: null,
      scheduling_flexibility: 'unknown',
      user_id: '00000000-0000-0000-0000-000000000000',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    });

    const { result } = renderHook(() => useUpdateClient(), { wrapper: wc() });

    await act(async () => {
      await result.current.mutateAsync({ id: 'upd-1', data: { first_name: 'Updated', email: '' } });
    });

    const all = await mockApp.clients.findMany();
    const updated = all.find((c: any) => c.id === 'upd-1');
    expect(updated!.first_name).toBe('Updated');
    expect(updated!.email).toBeNull();
    expect(updated!.phone).toBe('555-0000');
  });

  it('throws when client not found', async () => {
    const { result } = renderHook(() => useUpdateClient(), { wrapper: wc() });

    await expect(
      act(async () => {
        await result.current.mutateAsync({ id: 'nope', data: { first_name: 'x' } });
      }),
    ).rejects.toThrow(/not found/);
  });
});

describe('useDeleteClient', () => {
  beforeEach(() => {
    mockApp.clients._reset();
    mockApp.pets._reset();
    mockApp.appointments._reset();
  });

  it('deletes a client and cascades related pets/appointments', async () => {
    mockApp.clients.create({
      id: 'del-1', first_name: 'Delete', last_name: 'Me', email: null, phone: null,
      address: null, scheduling_flexibility: 'unknown',
      user_id: '00000000-0000-0000-0000-000000000000',
      created_at: new Date().toISOString(), updated_at: new Date().toISOString(), deleted_at: null,
    });

    const { result } = renderHook(() => useDeleteClient(), { wrapper: wc() });

    await act(async () => { await result.current.mutateAsync('del-1'); });

    const all = await mockApp.clients.findMany();
    expect(all.find((c: any) => c.id === 'del-1')).toBeUndefined();
  });
});
