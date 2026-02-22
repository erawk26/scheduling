/**
 * Portal Auth Client
 *
 * Separate auth client for the client-facing portal.
 * Uses magic link authentication instead of email/password.
 */

import { createAuthClient } from "better-auth/react"
import { magicLinkClient } from "better-auth/client/plugins"

export const portalAuthClient = createAuthClient({
  baseURL: typeof window !== "undefined" ? window.location.origin : "",
  plugins: [
    magicLinkClient(),
  ],
})
