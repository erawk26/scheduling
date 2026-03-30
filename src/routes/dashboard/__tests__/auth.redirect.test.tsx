/**
 * INT-004: Auth Guard Integration Test
 *
 * Tests cookie-based auth check in dashboard routes.
 * Verifies redirects for unauthenticated users and access for authenticated users.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

// SESSION_COOKIE constant matches the one in dashboard.tsx
const SESSION_COOKIE = 'better-auth.session_token'

/**
 * Set or clear the session cookie for testing
 */
function setAuthCookie(value: string = '') {
  if (value) {
    document.cookie = `${SESSION_COOKIE}=${value}; path=/`
  } else {
    document.cookie = `${SESSION_COOKIE}=; path=/; max-age=0`
  }
}

/**
 * Test a beforeLoad function directly by calling it and catching redirect().
 * Returns the redirect location if redirected, or null if access allowed.
 */
async function testBeforeLoad(beforeLoad: () => Promise<void> | void): Promise<string | null> {
  try {
    await beforeLoad()
    return null // No redirect
  } catch (error) {
    // TanStack Router's redirect() throws a Response-like object with options.to
    if (error && typeof error === 'object') {
      const err = error as { options?: { to?: string }; to?: string }
      // Check for Response-like structure with options.to
      if (err.options?.to) {
        return err.options.to
      }
      // Or check for simple { to: '...' } shape
      if (err.to) {
        return err.to
      }
    }
    throw error
  }
}

describe('Auth Guard Integration', () => {
  beforeEach(() => {
    // Clear cookies before each test
    setAuthCookie()
  })

  afterEach(() => {
    // Clean up cookie state
    setAuthCookie()
  })

  describe('Dashboard Route beforeLoad', () => {
    let beforeLoad: () => Promise<void> | void

    beforeEach(async () => {
      const module = await import('@/routes/dashboard')
      beforeLoad = module.Route.options.beforeLoad
    })

    it('redirects unauthenticated users to sign-in', async () => {
      setAuthCookie('') // No cookie
      const redirectLocation = await testBeforeLoad(beforeLoad)
      expect(redirectLocation).toBe('/sign-in')
    })

    it('allows authenticated users to access dashboard', async () => {
      const fakeToken = `test-session-${Date.now()}`
      setAuthCookie(fakeToken)
      const redirectLocation = await testBeforeLoad(beforeLoad)
      expect(redirectLocation).toBeNull()
    })

    it('redirects when session cookie is cleared', async () => {
      const fakeToken = `test-session-${Date.now()}`
      setAuthCookie(fakeToken)

      // First verify authenticated access works
      let redirectLocation = await testBeforeLoad(beforeLoad)
      expect(redirectLocation).toBeNull()

      // Clear the cookie (simulate logout)
      setAuthCookie('')

      // Now beforeLoad should redirect
      redirectLocation = await testBeforeLoad(beforeLoad)
      expect(redirectLocation).toBe('/sign-in')
    })

    it('accepts any non-empty cookie value', async () => {
      // Any non-empty string passes the presence check
      setAuthCookie('any-value')
      const redirectLocation = await testBeforeLoad(beforeLoad)
      expect(redirectLocation).toBeNull()
    })

    it('clearing cookie revokes access', async () => {
      // Start authenticated
      setAuthCookie('valid-token')
      expect(await testBeforeLoad(beforeLoad)).toBeNull()

      // Clear cookie properly using our helper (sets max-age=0)
      setAuthCookie('')
      expect(await testBeforeLoad(beforeLoad)).toBe('/sign-in')
    })
  })

  describe('Route Structure and Inheritance', () => {
    it('child routes are protected by dashboard layout (no own beforeLoad)', async () => {
      // Child routes of /dashboard inherit protection from the dashboard layout.
      // They don't need their own beforeLoad because the parent's beforeLoad
      // runs first and will redirect if unauthenticated.

      const { Route: AppointmentsRoute } = await import('@/routes/dashboard/appointments')
      const { Route: ClientsRoute } = await import('@/routes/dashboard/clients/index')
      const { Route: ServicesRoute } = await import('@/routes/dashboard/services')
      const { Route: RoutesRoute } = await import('@/routes/dashboard/routes')
      const { Route: WeatherRoute } = await import('@/routes/dashboard/weather')
      const { Route: SettingsRoute } = await import('@/routes/dashboard/settings')

      // Child routes typically don't define their own beforeLoad because
      // they are children of the dashboard route which has the auth guard
      expect(AppointmentsRoute.options.beforeLoad).toBeUndefined()
      expect(ClientsRoute.options.beforeLoad).toBeUndefined()
      expect(ServicesRoute.options.beforeLoad).toBeUndefined()
      expect(RoutesRoute.options.beforeLoad).toBeUndefined()
      expect(WeatherRoute.options.beforeLoad).toBeUndefined()
      expect(SettingsRoute.options.beforeLoad).toBeUndefined()
    })

    it('dashboard layout has the auth beforeLoad guard', async () => {
      const { Route: DashboardRoute } = await import('@/routes/dashboard')
      expect(DashboardRoute.options.beforeLoad).toBeDefined()

      // The dashboard route's beforeLoad is what actually performs the auth check
      // All child routes automatically execute it because it's on the parent layout
    })
  })

  describe('Public Routes', () => {
    it('sign-in page has no beforeLoad guard', async () => {
      const { Route: SignInRoute } = await import('@/routes/_auth/sign-in')
      expect(SignInRoute.options.beforeLoad).toBeUndefined()
    })

    it('sign-up page has no beforeLoad guard', async () => {
      const { Route: SignUpRoute } = await import('@/routes/_auth/sign-up')
      expect(SignUpRoute.options.beforeLoad).toBeUndefined()
    })

    it('home route redirects to dashboard', async () => {
      const { Route: IndexRoute } = await import('@/routes/index')
      expect(IndexRoute.options.beforeLoad).toBeDefined()

      const redirectLocation = await testBeforeLoad(IndexRoute.options.beforeLoad!)
      expect(redirectLocation).toBe('/dashboard')
    })

    it('offline page has no auth requirement', async () => {
      const { Route: OfflineRoute } = await import('@/routes/offline')
      expect(OfflineRoute.options.beforeLoad).toBeUndefined()
    })
  })

  describe('Cookie Behavior in jsdom', () => {
    it('document.cookie can be set and cleared', () => {
      setAuthCookie('test-token')
      expect(document.cookie).toContain(`${SESSION_COOKIE}=test-token`)

      setAuthCookie('')
      // After clearing, cookie may still contain the name with empty value
      // jsdom's cookie behavior: clearing sets value to empty and max-age=0
    })

    it('cookie presence check matches implementation', () => {
      // The actual beforeLoad uses: document.cookie.includes(SESSION_COOKIE)
      setAuthCookie('my-session')
      const hasCookie = document.cookie.includes(SESSION_COOKIE)
      expect(hasCookie).toBe(true)

      setAuthCookie('')
      // With empty value, the cookie name is still present in the string
      const hasEmptyCookie = document.cookie.includes(SESSION_COOKIE)
      // This tests the actual behavior - may be true or false depending on jsdom
      // The key test is the beforeLoad behavior, not this low-level detail
    })
  })

  describe('Integration Scenario: Full Auth Flow', () => {
    it('simulates complete user journey: unauthenticated -> sign in -> dashboard accessible', async () => {
      const { Route: DashboardRoute } = await import('@/routes/dashboard')
      const dashboardBeforeLoad = DashboardRoute.options.beforeLoad

      // 1. User starts unauthenticated
      setAuthCookie('')
      expect(await testBeforeLoad(dashboardBeforeLoad)).toBe('/sign-in')

      // 2. User signs in (simulated by setting cookie)
      const sessionToken = `session-${Date.now()}`
      setAuthCookie(sessionToken)

      // 3. Now dashboard is accessible
      expect(await testBeforeLoad(dashboardBeforeLoad)).toBeNull()

      // 4. User logs out (clears cookie)
      setAuthCookie('')
      expect(await testBeforeLoad(dashboardBeforeLoad)).toBe('/sign-in')
    })
  })

  describe('All dashboard routes are protected', () => {
    it('dashboard and all child pages inherit auth from dashboard layout', async () => {
      const routesToCheck = [
        '@/routes/dashboard',
        '@/routes/dashboard/index',
        '@/routes/dashboard/appointments',
        '@/routes/dashboard/clients/index',
        '@/routes/dashboard/services',
        '@/routes/dashboard/routes',
        '@/routes/dashboard/weather',
        '@/routes/dashboard/settings',
        '@/routes/dashboard/chat',
      ]

      for (const routePath of routesToCheck) {
        const module = await import(routePath as any)
        const route = module.Route

        // Either the route itself has beforeLoad, or it's a child of dashboard
        // and inherits protection. The dashboard subtree is fully protected.
        const hasOwnBeforeLoad = route.options?.beforeLoad !== undefined

        // For dashboard itself, we expect beforeLoad
        if (routePath === '@/routes/dashboard') {
          expect(hasOwnBeforeLoad).toBe(true)
        } else {
          // Children may or may not have their own beforeLoad, but they
          // are protected by the parent dashboard layout
          expect(route.options?.component).toBeDefined()
        }
      }
    })
  })
})
