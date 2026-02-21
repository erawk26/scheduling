/**
 * Business Location Hook
 *
 * Reads the trainer's business_latitude/business_longitude from the users table.
 * Used as fallback when a client has no coordinates set.
 */

'use client';

import { useQuery } from '@tanstack/react-query';
import { useDatabase } from '@/providers/database-provider';

const TEMP_USER_ID = 'local-user';

export function useBusinessLocation() {
  const { db, isReady } = useDatabase();

  return useQuery({
    queryKey: ['business-location'],
    queryFn: async (): Promise<{ lat: number | null; lon: number | null }> => {
      if (!db) throw new Error('Database not ready');

      const user = await db
        .selectFrom('users')
        .select(['business_latitude', 'business_longitude'])
        .where('id', '=', TEMP_USER_ID)
        .executeTakeFirst();

      return {
        lat: user?.business_latitude ?? null,
        lon: user?.business_longitude ?? null,
      };
    },
    enabled: isReady && !!db,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
