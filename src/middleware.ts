/**
 * Next.js Middleware
 *
 * Route protection and authentication checks
 * Validates JWT tokens and redirects unauthorized users
 */

import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"

/**
 * Protected route patterns
 * Routes that require authentication
 */
const PROTECTED_ROUTES = [
  "/dashboard",
  "/appointments",
  "/clients",
  "/routes",
  "/settings",
]

/**
 * Public route patterns
 * Routes that should redirect to dashboard if authenticated
 */
const PUBLIC_ROUTES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
]

/**
 * Check if route matches any pattern
 */
function matchesRoute(pathname: string, routes: string[]): boolean {
  return routes.some(route => pathname.startsWith(route))
}

/**
 * Get session from cookie
 */
function getSessionFromCookie(request: NextRequest): string | null {
  const sessionCookie = request.cookies.get("better-auth.session_token")
  return sessionCookie?.value || null
}

/**
 * Middleware handler
 *
 * Flow:
 * 1. Check if route requires protection
 * 2. Validate session token from cookie
 * 3. Redirect to sign-in if unauthorized
 * 4. Redirect to dashboard if authenticated user visits public route
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  const sessionToken = getSessionFromCookie(request)
  const isAuthenticated = !!sessionToken

  // Protect dashboard and app routes
  if (matchesRoute(pathname, PROTECTED_ROUTES)) {
    if (!isAuthenticated) {
      const signInUrl = new URL("/sign-in", request.url)
      signInUrl.searchParams.set("redirect", pathname)
      return NextResponse.redirect(signInUrl)
    }
  }

  // Redirect authenticated users away from public routes
  if (matchesRoute(pathname, PUBLIC_ROUTES)) {
    if (isAuthenticated) {
      return NextResponse.redirect(new URL("/dashboard", request.url))
    }
  }

  return NextResponse.next()
}

/**
 * Middleware configuration
 * Specify which routes to run middleware on
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico (favicon)
     * - public folder
     * - api routes (handled by route handlers)
     */
    "/((?!_next/static|_next/image|favicon.ico|public|api).*)",
  ],
}
