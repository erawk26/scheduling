/**
 * Authentication Provider
 *
 * React context provider for authentication state and actions
 * Provides sign-in, sign-up, and sign-out functionality
 */

"use client"

import React, { createContext, useContext, useCallback } from "react"
import { useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import { useSession } from "@/hooks/use-session"
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
  const { data: session, isLoading, error } = useSession()
  const router = useRouter()
  const queryClient = useQueryClient()

  /**
   * Sign in with email and password
   */
  const signIn = useCallback(async (credentials: SignInCredentials) => {
    try {
      const response = await fetch("/api/auth/sign-in/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Sign in failed")
      }

      // Invalidate session cache to refetch
      await queryClient.invalidateQueries({ queryKey: ["auth-session"] })

      router.push("/dashboard")
    } catch (error) {
      console.error("Sign in error:", error)
      throw error
    }
  }, [queryClient, router])

  /**
   * Sign up new user
   */
  const signUp = useCallback(async (credentials: SignUpCredentials) => {
    try {
      const response = await fetch("/api/auth/sign-up/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.message || "Sign up failed")
      }

      // Invalidate session cache to refetch
      await queryClient.invalidateQueries({ queryKey: ["auth-session"] })

      router.push("/verify-email")
    } catch (error) {
      console.error("Sign up error:", error)
      throw error
    }
  }, [queryClient, router])

  /**
   * Sign out current user
   */
  const signOut = useCallback(async () => {
    try {
      await fetch("/api/auth/sign-out", {
        method: "POST",
        credentials: "include",
      })

      // Clear session cache
      queryClient.setQueryData(["auth-session"], null)

      router.push("/dashboard")
    } catch (error) {
      console.error("Sign out error:", error)
      throw error
    }
  }, [queryClient, router])

  const value: AuthContextValue = {
    session,
    isLoading,
    error,
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
 *
 * @example
 * ```typescript
 * const { session, signIn, signOut } = useAuth()
 *
 * if (!session) {
 *   return <button onClick={() => signIn(credentials)}>Sign In</button>
 * }
 *
 * return <button onClick={signOut}>Sign Out</button>
 * ```
 */
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }

  return context
}
