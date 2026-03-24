'use client';

import { useMemo } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useCollection } from 'mpb-localkit/react';
import { app } from '@/lib/offlinekit';
import type { Client } from '@/lib/offlinekit/schema';
import type { ClientFormData } from '@/lib/validations';

type WithMeta<T> = T & { _id: string; _deleted: boolean };
import { geocodeAddress } from '@/lib/graphhopper/geocode';

export function useClients(search?: string) {
  const { data, isLoading, error } = useCollection(app.clients);

  const filtered = useMemo(() => {
    if (!data) return [];
    let result = data.filter((c) => !c._deleted);
    if (search?.trim()) {
      const s = search.toLowerCase();
      result = result.filter(
        (c) =>
          c.first_name.toLowerCase().includes(s) ||
          c.last_name.toLowerCase().includes(s)
      );
    }
    return result.sort((a, b) =>
      `${a.last_name} ${a.first_name}`.localeCompare(`${b.last_name} ${b.first_name}`)
    );
  }, [data, search]);

  return { data: filtered, isLoading, error };
}

export function useClient(id: string) {
  const { data, isLoading } = useCollection(app.clients);
  const client = useMemo(
    () => data?.find((c) => c.id === id && !c._deleted) ?? null,
    [data, id]
  );
  return { data: client as Client | null, isLoading };
}

export function useCreateClient() {
  return useMutation({
    mutationFn: async (data: ClientFormData): Promise<Client> => {
      const now = new Date().toISOString();
      const created = await app.clients.create({
        id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
        first_name: data.first_name,
        last_name: data.last_name,
        email: data.email ?? null,
        phone: data.phone ?? null,
        address: data.address ?? null,
        latitude: null,
        longitude: null,
        notes: data.notes ?? null,
        scheduling_flexibility: data.scheduling_flexibility ?? 'unknown',
        created_at: now,
        updated_at: now,
        version: 1,
        synced_at: null,
        deleted_at: null,
        needs_sync: 1,
        sync_operation: 'INSERT',
      });

      if (data.address) {
        geocodeAddress(data.address)
          .then(async (geo) => {
            if (!geo) return;
            await app.clients
              .update(created._id, {
                latitude: geo.lat,
                longitude: geo.lon,
                updated_at: new Date().toISOString(),
              })
              .catch(() => undefined);
          })
          .catch(() => undefined);
      }

      return created as unknown as Client;
    },
  });
}

export function useUpdateClient() {
  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ClientFormData>;
    }): Promise<Client> => {
      const all = await app.clients.findMany() as WithMeta<Client>[];
      const doc = all.find((d) => d.id === id && !d._deleted);
      if (!doc) throw new Error(`Client ${id} not found`);

      const updated = await app.clients.update(doc._id, {
        ...data,
        updated_at: new Date().toISOString(),
        needs_sync: 1,
        sync_operation: 'UPDATE',
      });

      if (data.address) {
        geocodeAddress(data.address)
          .then(async (geo) => {
            if (!geo) return;
            await app.clients
              .update(doc._id, {
                latitude: geo.lat,
                longitude: geo.lon,
                updated_at: new Date().toISOString(),
              })
              .catch(() => undefined);
          })
          .catch(() => undefined);
      }

      return updated as unknown as Client;
    },
  });
}

export function useDeleteClient() {
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const [allClients, allPets, allApts] = await Promise.all([
        app.clients.findMany() as Promise<WithMeta<Client>[]>,
        app.pets.findMany() as Promise<Array<{ _id: string; _deleted: boolean; client_id: string }>>,
        app.appointments.findMany() as Promise<Array<{ _id: string; _deleted: boolean; client_id: string }>>,
      ]);

      const doc = allClients.find((d) => d.id === id && !d._deleted);
      if (!doc) return;

      await Promise.all([
        ...allPets
          .filter((p) => p.client_id === id && !p._deleted)
          .map((p) => app.pets.delete(p._id)),
        ...allApts
          .filter((a) => a.client_id === id && !a._deleted)
          .map((a) => app.appointments.delete(a._id)),
      ]);

      await app.clients.delete(doc._id);
    },
  });
}
