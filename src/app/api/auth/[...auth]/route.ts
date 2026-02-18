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

import { auth } from "@/lib/auth"
import { toNextJsHandler } from "better-auth/next-js"

export const { GET, POST } = toNextJsHandler(auth)
