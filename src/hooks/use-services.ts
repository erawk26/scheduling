/**
 * Services CRUD Hook - TanStack Query + SQLite (Kysely)
 *
 * Local-first operations with automatic sync queuing
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDatabase } from '@/providers/database-provider';
import { v4 as uuidv4 } from 'uuid';
import type { Service } from '@/lib/database/types';
import type { ServiceFormData } from '@/lib/validations';

// TODO: Replace with actual auth session user ID
const TEMP_USER_ID = 'local-user';

/**
 * Query all services for current user
 */
export function useServices() {
  const { db, isReady } = useDatabase();

  return useQuery({
    queryKey: ['services'],
    queryFn: async (): Promise<Service[]> => {
      if (!db) throw new Error('Database not ready');

      const services = await db
        .selectFrom('services')
        .selectAll()
        .where('user_id', '=', TEMP_USER_ID)
        .where('deleted_at', 'is', null)
        .orderBy('name', 'asc')
        .execute();

      return services;
    },
    enabled: isReady && !!db,
  });
}

/**
 * Create a new service
 */
export function useCreateService() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: ServiceFormData): Promise<Service> => {
      if (!db) throw new Error('Database not ready');

      const id = uuidv4();
      const now = new Date().toISOString();

      await db
        .insertInto('services')
        .values({
          id,
          user_id: TEMP_USER_ID,
          name: data.name,
          description: data.description ?? null,
          duration_minutes: data.duration_minutes,
          price_cents: data.price_cents ?? null,
          weather_dependent: data.weather_dependent,
          location_type: data.location_type,
          created_at: now,
          updated_at: now,
          version: 1,
          needs_sync: 1,
          sync_operation: 'INSERT',
          synced_at: null,
          deleted_at: null,
        })
        .execute();

      // Return created service
      const service = await db
        .selectFrom('services')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      return service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

/**
 * Update an existing service
 */
export function useUpdateService() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<ServiceFormData>;
    }): Promise<Service> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      await db
        .updateTable('services')
        .set({
          ...data,
          updated_at: now,
          needs_sync: 1,
          sync_operation: 'UPDATE',
        })
        .where('id', '=', id)
        .execute();

      // Return updated service
      const service = await db
        .selectFrom('services')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      return service;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}

/**
 * Soft delete a service
 */
export function useDeleteService() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      await db
        .updateTable('services')
        .set({
          deleted_at: now,
          updated_at: now,
          needs_sync: 1,
          sync_operation: 'DELETE',
        })
        .where('id', '=', id)
        .execute();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['services'] });
    },
  });
}
