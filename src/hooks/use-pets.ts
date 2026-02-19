/**
 * Pets CRUD Hook - TanStack Query + SQLite (Kysely)
 *
 * Local-first operations with automatic sync queuing
 */

'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useDatabase } from '@/providers/database-provider';
import { v4 as uuidv4 } from 'uuid';
import type { Pet } from '@/lib/database/types';
import type { PetFormData } from '@/lib/validations';

/**
 * Query all pets for a specific client
 */
export function usePets(clientId: string) {
  const { db, isReady } = useDatabase();

  return useQuery({
    queryKey: ['pets', clientId],
    queryFn: async (): Promise<Pet[]> => {
      if (!db) throw new Error('Database not ready');

      const pets = await db
        .selectFrom('pets')
        .selectAll()
        .where('client_id', '=', clientId)
        .where('deleted_at', 'is', null)
        .orderBy('name', 'asc')
        .execute();

      return pets;
    },
    enabled: isReady && !!db && !!clientId,
  });
}

/**
 * Create a new pet
 */
export function useCreatePet() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (
      data: PetFormData & { client_id: string }
    ): Promise<Pet> => {
      if (!db) throw new Error('Database not ready');

      const id = uuidv4();
      const now = new Date().toISOString();

      await db
        .insertInto('pets')
        .values({
          id,
          client_id: data.client_id,
          name: data.name,
          species: data.species,
          breed: data.breed ?? null,
          size: data.size ?? null,
          age_years: data.age_years ?? null,
          weight_lbs: data.weight_lbs ?? null,
          behavior_notes: data.behavior_notes ?? null,
          medical_notes: data.medical_notes ?? null,
          created_at: now,
          updated_at: now,
          version: 1,
          needs_sync: 1,
          sync_operation: 'INSERT',
          synced_at: null,
          deleted_at: null,
        })
        .execute();

      // Return created pet
      const pet = await db
        .selectFrom('pets')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      return pet;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pets', data.client_id] });
    },
  });
}

/**
 * Update an existing pet
 */
export function useUpdatePet() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<PetFormData>;
    }): Promise<Pet> => {
      if (!db) throw new Error('Database not ready');

      const now = new Date().toISOString();

      await db
        .updateTable('pets')
        .set({
          ...data,
          updated_at: now,
          needs_sync: 1,
          sync_operation: 'UPDATE',
        })
        .where('id', '=', id)
        .execute();

      // Return updated pet
      const pet = await db
        .selectFrom('pets')
        .selectAll()
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      return pet;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['pets', data.client_id] });
    },
  });
}

/**
 * Soft delete a pet
 */
export function useDeletePet() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string): Promise<string> => {
      if (!db) throw new Error('Database not ready');

      // Get client_id before deletion for cache invalidation
      const pet = await db
        .selectFrom('pets')
        .select('client_id')
        .where('id', '=', id)
        .executeTakeFirstOrThrow();

      const now = new Date().toISOString();

      await db
        .updateTable('pets')
        .set({
          deleted_at: now,
          updated_at: now,
          needs_sync: 1,
          sync_operation: 'DELETE',
        })
        .where('id', '=', id)
        .execute();

      return pet.client_id;
    },
    onSuccess: (clientId) => {
      queryClient.invalidateQueries({ queryKey: ['pets', clientId] });
    },
  });
}
