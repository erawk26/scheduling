import { useMemo } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCollection } from '@erawk26/localkit/react';
import { app } from '@/lib/offlinekit';
import type { Pet } from '@/lib/offlinekit/schema';
import type { PetFormData } from '@/lib/validations';

type WithMeta<T> = T & { _id: string; _deleted: boolean };

export function usePets(clientId: string) {
  const { data, isLoading, error } = useCollection(app.pets);

  const filtered = useMemo(() => {
    if (!data || !clientId) return [];
    return data
      .filter((p) => p.client_id === clientId && !p._deleted)
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [data, clientId]);

  return { data: filtered, isLoading, error };
}

export function useCreatePet() {
  const queryClient = useQueryClient();
  return useMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['localkit', 'pets'] }),
    mutationFn: async (
      data: PetFormData & { client_id: string }
    ): Promise<Pet> => {
      const now = new Date().toISOString();
      const created = await app.pets.create({
        id: crypto.randomUUID(),
        user_id: '00000000-0000-0000-0000-000000000000',
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
        deleted_at: null,
      });

      return created as unknown as Pet;
    },
  });
}

export function useUpdatePet() {
  const queryClient = useQueryClient();
  return useMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['localkit', 'pets'] }),
    mutationFn: async ({
      id,
      data,
    }: {
      id: string;
      data: Partial<PetFormData>;
    }): Promise<Pet> => {
      const all = await app.pets.findMany() as WithMeta<Pet>[];
      const doc = all.find((d) => d.id === id && !d._deleted);
      if (!doc) throw new Error(`Pet ${id} not found`);

      const updated = await app.pets.update(doc._id, {
        ...data,
        updated_at: new Date().toISOString(),
      });

      return updated as unknown as Pet;
    },
  });
}

export function useDeletePet() {
  const queryClient = useQueryClient();
  return useMutation({
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['localkit', 'pets'] }),
    mutationFn: async (id: string): Promise<string> => {
      const all = await app.pets.findMany() as WithMeta<Pet>[];
      const doc = all.find((d) => d.id === id && !d._deleted);
      if (!doc) return '';
      await app.pets.delete(doc._id);
      return doc.client_id;
    },
  });
}
