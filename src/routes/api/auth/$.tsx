/**
 * Better Auth API Route Handler
 *
 * Catch-all route for Better Auth endpoints:
 * - /api/auth/sign-in
 * - /api/auth/sign-up
 * - /api/auth/sign-out
 * - /api/auth/session
 * - /api/auth/callback/google
 * - /api/auth/callback/apple
 */

import { createFileRoute } from '@tanstack/react-router'
import { auth } from '@/lib/auth'

export const Route = createFileRoute('/api/auth/$')({
  server: {
    handlers: {
      GET: async ({ request }) => auth.handler(request),
      POST: async ({ request }) => auth.handler(request),
    },
  },
})
