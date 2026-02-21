/**
 * Better Auth Client
 *
 * Typed client for client-side auth operations.
 * Uses Better Auth's built-in React integration.
 */

import { createAuthClient } from "better-auth/react"

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
})
