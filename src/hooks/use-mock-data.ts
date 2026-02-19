'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDatabase } from '@/providers/database-provider';
import { seedMockData, cleanupMockData } from '@/lib/mock-data';

export function useSeedMockData() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!db) throw new Error('Database not ready');
      await seedMockData(db);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useCleanupMockData() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      if (!db) throw new Error('Database not ready');
      await cleanupMockData(db);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
