'use client';

import { useAuth } from '@/providers/auth-provider';

export function useUserId(): string {
  const { session } = useAuth();
  return session?.user?.id ?? 'local-user';
}
