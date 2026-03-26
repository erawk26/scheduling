/**
 * Authentication Provider
 *
 * React context provider for authentication state and actions.
 * Uses Better Auth's typed client for sign-in, sign-up, and sign-out.
 */

"use client"

import React, { createContext, useContext, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { authClient } from "@/lib/auth-client"
import type {
  AuthSession,
  SignInCredentials,
  SignUpCredentials,
  AuthError
} from "@/types/auth"

interface AuthContextValue {
  session: AuthSession | null
  isLoading: boolean
  error: AuthError | null
  signIn: (credentials: SignInCredentials) => Promise<void>
  signUp: (credentials: SignUpCredentials) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined)

/**
 * Auth Provider Component
 *
 * Wraps the application to provide authentication context
 */
export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { data: session, isPending: isLoading, error } = authClient.useSession()
  const router = useRouter()
  const queryClient = useQueryClient()

  const signIn = useCallback(async (credentials: SignInCredentials) => {
    const { error } = await authClient.signIn.email({
      email: credentials.email,
      password: credentials.password,
    })

    if (error) {
      throw new Error(error.message || "Sign in failed")
    }

    await queryClient.invalidateQueries({ queryKey: ["auth-session"] })
    router.push("/dashboard")
  }, [queryClient, router])

  const signUp = useCallback(async (credentials: SignUpCredentials) => {
    const { error } = await authClient.signUp.email({
      email: credentials.email,
      password: credentials.password,
      name: credentials.name || credentials.email,
    })

    if (error) {
      throw new Error(error.message || "Sign up failed")
    }

    await queryClient.invalidateQueries({ queryKey: ["auth-session"] })
    router.push("/dashboard")
  }, [queryClient, router])

  const signOut = useCallback(async () => {
    await authClient.signOut()

    queryClient.setQueryData(["auth-session"], null)
    router.push("/sign-in")
  }, [queryClient, router])

  // If session fetch errored (e.g., 500 from stale cookie), clear the error
  // and treat as unauthenticated rather than showing a broken state
  const sessionError = error && !session ? null : error
  const effectiveSession = error && !session ? null : (session as unknown as AuthSession | null)

  const value: AuthContextValue = {
    session: effectiveSession,
    isLoading,
    error: sessionError,
    signIn,
    signUp,
    signOut,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

/**
 * Hook to access authentication context
 *
 * @throws Error if used outside AuthProvider
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }

  return context
}
