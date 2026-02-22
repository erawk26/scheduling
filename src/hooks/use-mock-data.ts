'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useDatabase } from '@/providers/database-provider';
import { seedMockData, cleanupMockData } from '@/lib/mock-data';
import { useUserId } from '@/hooks/use-user-id';

export function useSeedMockData() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();
  const userId = useUserId();

  return useMutation({
    mutationFn: async () => {
      if (!db) throw new Error('Database not ready');
      await seedMockData(db, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}

export function useCleanupMockData() {
  const { db } = useDatabase();
  const queryClient = useQueryClient();
  const userId = useUserId();

  return useMutation({
    mutationFn: async () => {
      if (!db) throw new Error('Database not ready');
      await cleanupMockData(db, userId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
    },
  });
}
