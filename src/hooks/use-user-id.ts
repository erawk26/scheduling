import { useAuth } from '@/providers/auth-provider';

export function useUserId(): string {
  const { session } = useAuth();
  return session?.user?.id ?? '00000000-0000-0000-0000-000000000000';
}
