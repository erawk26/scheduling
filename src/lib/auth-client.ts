/**
 * Better Auth Client
 *
 * Typed client for client-side auth operations.
 * Uses Better Auth's built-in React integration.
 * Includes JWT plugin for Hasura token retrieval.
 */

import { createAuthClient } from "better-auth/react"
import { jwtClient } from "better-auth/client/plugins"

export const authClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
  plugins: [
    jwtClient(),
  ],
})
