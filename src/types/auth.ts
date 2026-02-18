/**
 * Authentication Types
 *
 * Type definitions for Better Auth integration
 */

export interface User {
  id: string
  email: string
  emailVerified: boolean
  name?: string | null
  image?: string | null
  businessName?: string | null
  phone?: string | null
  createdAt: Date
  updatedAt: Date
}

export interface Session {
  id: string
  userId: string
  expiresAt: Date
  token: string
  ipAddress?: string
  userAgent?: string
  user: User
}

export interface AuthSession {
  user: User
  session: Session
}

export interface SignInCredentials {
  email: string
  password: string
}

export interface SignUpCredentials {
  email: string
  password: string
  name?: string
  businessName?: string
  phone?: string
}

export interface AuthError {
  message: string
  code?: string
}

export interface UseSessionResult {
  data: AuthSession | null
  isLoading: boolean
  error: AuthError | null
}
