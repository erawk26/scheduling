/**
 * useSession Hook
 *
 * Client-side hook for accessing authentication session
 * Wraps Better Auth's session management with React Query
 */

"use client"

import { useQuery } from "@tanstack/react-query"
import type { UseSessionResult, AuthSession } from "@/types/auth"

/**
 * Fetch current session from Better Auth
 */
async function fetchSession(): Promise<AuthSession | null> {
  try {
    const response = await fetch("/api/auth/get-session", {
      credentials: "include",
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    if (!data) return null
    return data
  } catch (error) {
    console.error("Session fetch error:", error)
    return null
  }
}

/**
 * React hook for accessing authentication session
 *
 * @returns Session data, loading state, and error
 *
 * @example
 * ```typescript
 * const { data: session, isLoading, error } = useSession()
 *
 * if (isLoading) return <LoadingSpinner />
 * if (!session) return <SignInPrompt />
 *
 * return <div>Welcome {session.user.email}</div>
 * ```
 */
export function useSession(): UseSessionResult {
  const { data, isLoading, error } = useQuery<AuthSession | null>({
    queryKey: ["auth-session"],
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000, // 5 minutes (matches cookie cache)
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    refetchOnWindowFocus: true,
    retry: 1,
  })

  return {
    data: data || null,
    isLoading,
    error: error ? { message: String(error) } : null,
  }
}
