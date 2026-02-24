/**
 * Clients CRUD Hook - TanStack Query + SQLite (Kysely)
 *
 * Local-first operations with automatic sync queuing
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDatabase } from '@/providers/database-provider';
import { useUserId } from '@/hooks/use-user-id';
import { v4 as uuidv4 } from 'uuid';
import type { Client } from '@/lib/database/types';
import type { ClientFormData } from '@/lib/validations';
import { geocodeAddress } from '@/lib/graphhopper/geocode';

/**
 * Query all clients for current user with optional search
 */
export function useClients(search?: string) {
  const { db, isReady } = useDatabase();
  const userId = useUserId();

  return useQuery({
    queryKey: ['clients', search],
    queryFn: async (): Promise<Client[]> => {
      if (!db) throw new Error('Database not ready');

      let query = db
        .selectFrom('clients')
        .selectAll()
        .where('user_id', '=', userId)
        .where('deleted_at', 'is', null);

      // Add search filter if provided
      if (search && search.trim() !== '') {
        const searchPattern = `%${search}%`;
        query = query.where((eb) =>
          eb.or([
            eb('first_name', 'like', searchPattern),
            eb('last_name', 'like', searchPattern),
          ])
        );
      }

      const clients = await query
        .orderBy('last_name', 'asc')
        .orderBy('first_name', 'asc')
        .execute();

      return clients;
    },
    enabled: isReady && !!db,
  });
}

/**
 * Query a single client by ID
 */
export function useClient(id: string) {
  const { db, isReady } = useDatabase();

  return useQuery({
    queryKey: ['clients', id],
    queryFn: async (): Promise<Client | null> => {
      if (!db) throw new Error('Database not ready');

      const client = await db
        .selectFrom('clients')
        .selectAll()
        .where('id', '=', id)
        .where('deleted_at', 'is', null)
        .executeTakeFirst();

      return client ?? null;
    },
    enabled: isReady && !!db && !!id,
  });
}

/**
 * Create a new client
 */
export function useCreateClient() {
  const { db, syncEngine } = useDatabase();
  const queryClient = useQueryClient();
  const userId = useUserId();

  return useMutation({
    mutationFn: async (data: ClientFormData): Promise<Client> => {
      if (!db) throw new Error('Database not ready');

      const id = uuidv4();
      const now = new Date().toISOString();

      await db
        .insertInto('clients')
        .values({
          id,
          user_id: userId,
          first_name: data.first_name,
          last_name: data.last_name,
          email: data.email ?? null,
          phone: data.phone ?? null,
          address: data.address ?? null,
          latitude: null,
          longitude: null,
          notes: data.notes ?? null,
          created_at: now,
          updated_at: now,
          version: 1,
          needs_sync: 1,
          sync_operation: 'INSERT',
          synced_at: null,
          deleted_at: null,
        })
        .execute();

      // Return created client
      const client = await db
        .selectFrom('clients')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      syncEngine?.queueMutation('clients', 'CREATE', id, client);

      // Fire-and-forget geocoding - does not block the mutation
      if (data.address) {
        geocodeAddress(data.address).then((geo) => {
          if (!geo) return;
          db.updateTable('clients')
            .set({
              latitude: geo.lat,
              longitude: geo.lon,
              updated_at: new Date().toISOString().slice(0, 19),
            })
            .where('id', '=', id)
            .execute()
            .catch(() => undefined);
        }).catch(() => undefined);
      }

      return client;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
}

/**
 * Update an existing client
 */
export function useUpdateClient() {
  const { db, syncEngine } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ClientFormData>;
    }): Promise<Client> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      await db
        .updateTable('clients')
        .set({
          ...data,
          updated_at: now,
          needs_sync: 1,
          sync_operation: 'UPDATE',
        })
        .where('id', '=', id)
        .execute();

      // Return updated client
      const client = await db
        .selectFrom('clients')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      syncEngine?.queueMutation('clients', 'UPDATE', id, client);

      // Fire-and-forget geocoding when address changes - does not block the mutation
      if (data.address) {
        geocodeAddress(data.address).then((geo) => {
          if (!geo) return;
          db.updateTable('clients')
            .set({
              latitude: geo.lat,
              longitude: geo.lon,
              updated_at: new Date().toISOString().slice(0, 19),
            })
            .where('id', '=', id)
            .execute()
            .catch(() => undefined);
        }).catch(() => undefined);
      }

      return client;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['clients', data.id] });
    },
  });
}

/**
 * Soft delete a client
 */
export function useDeleteClient() {
  const { db, syncEngine } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      // Cascade soft-delete to pets belonging to this client
      await db
        .updateTable('pets')
        .set({
          deleted_at: now,
          updated_at: now,
          needs_sync: 1,
          sync_operation: 'DELETE',
        })
        .where('client_id', '=', id)
        .where('deleted_at', 'is', null)
        .execute();

      // Cascade soft-delete to appointments belonging to this client
      await db
        .updateTable('appointments')
        .set({
          deleted_at: now,
          updated_at: now,
          needs_sync: 1,
          sync_operation: 'DELETE',
        })
        .where('client_id', '=', id)
        .where('deleted_at', 'is', null)
        .execute();

      // Soft-delete the client
      await db
        .updateTable('clients')
        .set({
          deleted_at: now,
          updated_at: now,
          needs_sync: 1,
          sync_operation: 'DELETE',
        })
        .where('id', '=', id)
        .execute();

      syncEngine?.queueMutation('clients', 'DELETE', id, { id, deleted_at: now });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      queryClient.invalidateQueries({ queryKey: ['pets'] });
      queryClient.invalidateQueries({ queryKey: ['appointments'] });
    },
  });
}
