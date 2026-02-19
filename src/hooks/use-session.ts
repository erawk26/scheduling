/**
 * useSession Hook
 *
 * Client-side hook for accessing authentication session
 * Wraps Better Auth's session management with React Query
 *
 * LOCAL-FIRST: Caches session to localStorage so the app
 * continues working when offline.
 */

"use client"

import { useQuery } from "@tanstack/react-query"
import type { UseSessionResult, AuthSession } from "@/types/auth"

const SESSION_CACHE_KEY = "ke-agenda-session"

/**
 * Save session to localStorage for offline access
 */
function cacheSession(session: AuthSession | null): void {
  try {
    if (session) {
      localStorage.setItem(SESSION_CACHE_KEY, JSON.stringify(session))
    }
  } catch {
    // localStorage unavailable (SSR, private browsing)
  }
}

/**
 * Retrieve cached session from localStorage
 */
function getCachedSession(): AuthSession | null {
  try {
    const cached = localStorage.getItem(SESSION_CACHE_KEY)
    return cached ? JSON.parse(cached) : null
  } catch {
    return null
  }
}

/**
 * Clear cached session (used on sign-out)
 */
export function clearCachedSession(): void {
  try {
    localStorage.removeItem(SESSION_CACHE_KEY)
  } catch {
    // ignore
  }
}

/**
 * Fetch current session from Better Auth
 * Falls back to cached session when offline
 */
async function fetchSession(): Promise<AuthSession | null> {
  try {
    const response = await fetch("/api/auth/get-session", {
      credentials: "include",
    })

    if (!response.ok) {
      // Server responded but session is invalid - don't use cache
      return null
    }

    const data = await response.json()
    if (!data) return null

    // Cache successful session for offline use
    cacheSession(data)
    return data
  } catch {
    // Network error (offline) - fall back to cached session
    return getCachedSession()
  }
}

/**
 * React hook for accessing authentication session
 *
 * LOCAL-FIRST: When offline, returns the last known session
 * from localStorage so the app remains functional.
 */
export function useSession(): UseSessionResult {
  const { data, isLoading, error } = useQuery<AuthSession | null>({
    queryKey: ["auth-session"],
    queryFn: fetchSession,
    staleTime: 5 * 60 * 1000, // 5 minutes (matches cookie cache)
    refetchInterval: 5 * 60 * 1000, // Refetch every 5 minutes
    refetchOnWindowFocus: true,
    retry: 1,
    // Start with cached data so UI doesn't flash unauthenticated
    initialData: () => {
      if (typeof window === "undefined") return null
      return getCachedSession()
    },
  })

  return {
    data: data || null,
    isLoading: isLoading && !data,
    error: error ? { message: String(error) } : null,
  }
}
