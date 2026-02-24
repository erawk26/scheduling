/**
 * Next.js Middleware
 *
 * Optimistic cookie-based route protection. Checks for the
 * Better Auth session cookie and redirects to sign-in if absent.
 * This is NOT a security boundary - actual session validation
 * happens in pages/routes via the API.
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

const SESSION_COOKIE = "better-auth.session_token"

export function middleware(request: NextRequest) {
  const sessionCookie = request.cookies.get(SESSION_COOKIE)

  if (!sessionCookie?.value) {
    const signInUrl = new URL("/sign-in", request.url)
    signInUrl.searchParams.set("redirect", request.nextUrl.pathname)
    return NextResponse.redirect(signInUrl)
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/dashboard/:path*"],
}
