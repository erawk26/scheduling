/**
 * INT-005: Route Rendering Integration Tests
 *
 * Verifies that all TanStack Start route modules can be imported and have
 * the expected structure. This is a smoke test to catch basic issues.
 *
 * Coverage: 33 routes (all user-facing pages, layouts, and API handlers)
 */

import { describe, it, expect } from 'vitest'

// Environment setup
process.env.BETTER_AUTH_SECRET = 'test-secret-key-for-testing-only'
process.env.BETTER_AUTH_URL = 'http://localhost:3000'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.APPLE_CLIENT_ID = 'test-apple-client-id'
process.env.APPLE_CLIENT_SECRET = 'test-apple-client-secret'
process.env.OPENROUTER_API_KEY = 'test-key-for-rendering'
process.env.GRAPHHOPPER_API_KEY = 'test-key-for-rendering'
process.env.TOMORROW_IO_API_KEY = 'test-key-for-rendering'
process.env.RESEND_API_KEY = 'test-key-for-rendering'
process.env.TELEGRAM_BOT_TOKEN = 'test-key-for-rendering'

// ResizeObserver polyfill
global.ResizeObserver = class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
} as unknown as typeof ResizeObserver

// ===========================================================================
// Route file definitions
// ===========================================================================

const componentRouteFiles = [
  // Core Layout Routes (7)
  'src/routes/__root.tsx',
  'src/routes/_auth.tsx',
  'src/routes/_auth/sign-in.tsx',
  'src/routes/_auth/sign-up.tsx',
  'src/routes/_auth/verify-email.tsx',
  'src/routes/dashboard.tsx',

  // Dashboard Pages (9)
  'src/routes/dashboard/index.tsx',
  'src/routes/dashboard/chat.tsx',
  'src/routes/dashboard/appointments.tsx',
  'src/routes/dashboard/clients/index.tsx',
  'src/routes/dashboard/clients/$id.tsx',
  'src/routes/dashboard/services.tsx',
  'src/routes/dashboard/routes.tsx',
  'src/routes/dashboard/weather.tsx',

  // Settings Pages (4)
  'src/routes/dashboard/settings/index.tsx',
  'src/routes/dashboard/settings/profile.tsx',
  'src/routes/dashboard/settings/messaging.tsx',
  'src/routes/dashboard/settings/billing.tsx',

  // Client-Facing Pages (3)
  'src/routes/offline.tsx',
  'src/routes/book/$token/index.tsx',
  'src/routes/book/$token/confirmed.tsx',
]

const redirectOnlyRoutes = [
  // Index route redirects to dashboard
  'src/routes/index.tsx',
]

const apiRouteFiles = [
  // API Routes (11)
  'src/routes/api/auth/$.tsx',
  'src/routes/api/agent/chat.tsx',
  'src/routes/api/weather/forecast.tsx',
  'src/routes/api/geocode.tsx',
  'src/routes/api/credits.tsx',
  'src/routes/api/routes/optimize.tsx',
  'src/routes/api/schedule/suggest.tsx',
  'src/routes/api/email/send.tsx',
  'src/routes/api/book/confirm.tsx',
  'src/routes/api/messaging/telegram/setup.tsx',
  'src/routes/api/messaging/webhook.tsx',
]

const allRouteFiles = [...componentRouteFiles, ...redirectOnlyRoutes, ...apiRouteFiles]

// ===========================================================================
// Tests
// ===========================================================================

describe('Route Rendering Integration (INT-005)', () => {
  describe('Route inventory', () => {
    it('has 33 total routes', () => {
      expect(allRouteFiles.length).toBe(33)
    })

    it('has 21 component/layout routes (excluding redirect-only index)', () => {
      expect(componentRouteFiles.length).toBe(21)
    })

    it('has 1 redirect-only route (index)', () => {
      expect(redirectOnlyRoutes.length).toBe(1)
    })

    it('has 11 API routes', () => {
      expect(apiRouteFiles.length).toBe(11)
    })
  })

  describe('Import all route modules', () => {
    for (const filePath of allRouteFiles) {
      const testName = filePath
        .replace('src/routes/', '')
        .replace('.tsx', '')
        .replace(/\//g, '/')

      it(`can import ${testName}`, async () => {
        const importPath = filePath
          .replace(/^src\//, '')
          .replace(/\.tsx$/, '')
        const module = await import(`@/${importPath}`)

        // All route modules must export Route
        expect(module.Route).toBeDefined()
        expect(typeof module.Route).toBe('object')
      })
    }
  })

  describe('Component/Layout route structure', () => {
    for (const filePath of componentRouteFiles) {
      const testName = filePath
        .replace('src/routes/', '')
        .replace('.tsx', '')
        .replace(/\//g, '/')

      it(`${testName} has options with component property`, async () => {
        const importPath = filePath
          .replace(/^src\//, '')
          .replace(/\.tsx$/, '')
        const module = await import(`@/${importPath}`)

        // TanStack Start routes have options property
        expect(module.Route.options).toBeDefined()
        expect(typeof module.Route.options).toBe('object')

        // Component routes/layouts should have component in options
        expect(module.Route.options.component).toBeDefined()
        expect(typeof module.Route.options.component).toBe('function')
      })
    }
  })

  describe('Redirect-only route structure', () => {
    it('index.tsx has options with beforeLoad (redirect) but no component', async () => {
      const mod = await import(`@/routes/index.tsx`)
      expect(mod.Route.options).toBeDefined()
      expect(mod.Route.options.beforeLoad).toBeDefined()
      // This route redirects, so no component
      expect(mod.Route.options.component).toBeUndefined()
    })
  })

  describe('API route structure', () => {
    for (const filePath of apiRouteFiles) {
      const testName = filePath
        .replace('src/routes/', '')
        .replace('.tsx', '')
        .replace(/\//g, '/')

      it(`${testName} has options with server.handlers`, async () => {
        const importPath = filePath
          .replace(/^src\//, '')
          .replace(/\.tsx$/, '')
        const module = await import(`@/${importPath}`)

        // API routes should have server in options
        expect(module.Route.options.server).toBeDefined()
        expect(typeof module.Route.options.server).toBe('object')

        // Handlers are under server.handlers
        const handlers = module.Route.options.server.handlers
        expect(handlers).toBeDefined()
        expect(typeof handlers).toBe('object')

        // Should have at least one handler (GET or POST)
        const hasGet = typeof handlers.GET === 'function'
        const hasPost = typeof handlers.POST === 'function'
        expect(hasGet || hasPost).toBe(true)
      })
    }
  })

  describe('Specific route assertions', () => {
    it('Root route (__root) has isRoot flag', async () => {
      const mod = await import(`@/routes/__root.tsx`)
      expect(mod.Route.isRoot).toBe(true)
    })

    it('Dashboard layout has both beforeLoad and component', async () => {
      const mod = await import(`@/routes/dashboard.tsx`)
      expect(mod.Route.options.beforeLoad).toBeDefined()
      expect(mod.Route.options.component).toBeDefined()
    })

    it('API auth catch-all has both GET and POST handlers', async () => {
      const mod = await import(`@/routes/api/auth/$.tsx`)
      expect(mod.Route.options.server?.handlers?.GET).toBeDefined()
      expect(mod.Route.options.server?.handlers?.POST).toBeDefined()
    })

    it('API agent chat has POST handler', async () => {
      const mod = await import(`@/routes/api/agent/chat.tsx`)
      expect(mod.Route.options.server?.handlers?.POST).toBeDefined()
    })

    it('API weather forecast has GET handler', async () => {
      const mod = await import(`@/routes/api/weather/forecast.tsx`)
      expect(mod.Route.options.server?.handlers?.GET).toBeDefined()
    })

    it('API email send expects POST handler (sending email)', async () => {
      const mod = await import(`@/routes/api/email/send.tsx`)
      expect(mod.Route.options.server?.handlers?.POST).toBeDefined()
    })

    it('Client booking routes (dynamic) have component', async () => {
      const bookIndex = await import(`@/routes/book/$token/index.tsx`)
      const bookConfirmed = await import(`@/routes/book/$token/confirmed.tsx`)
      expect(bookIndex.Route.options.component).toBeDefined()
      expect(bookConfirmed.Route.options.component).toBeDefined()
    })

    it('Client detail route (dynamic) has component', async () => {
      const mod = await import(`@/routes/dashboard/clients/$id.tsx`)
      expect(mod.Route.options.component).toBeDefined()
    })
  })

  describe('Layout inheritance', () => {
    it('Auth layout (_auth) and its children both have components', async () => {
      const authLayout = await import(`@/routes/_auth.tsx`)
      const signIn = await import(`@/routes/_auth/sign-in.tsx`)
      const signUp = await import(`@/routes/_auth/sign-up.tsx`)
      const verifyEmail = await import(`@/routes/_auth/verify-email.tsx`)

      expect(authLayout.Route.options.component).toBeDefined()
      expect(signIn.Route.options.component).toBeDefined()
      expect(signUp.Route.options.component).toBeDefined()
      expect(verifyEmail.Route.options.component).toBeDefined()
    })

    it('Dashboard layout (dashboard.tsx) and its children have components', async () => {
      const dashboardLayout = await import(`@/routes/dashboard.tsx`)
      const dashboardIndex = await import(`@/routes/dashboard/index.tsx`)
      const dashboardChat = await import(`@/routes/dashboard/chat.tsx`)
      const dashboardAppointments = await import(`@/routes/dashboard/appointments.tsx`)

      expect(dashboardLayout.Route.options.component).toBeDefined()
      expect(dashboardIndex.Route.options.component).toBeDefined()
      expect(dashboardChat.Route.options.component).toBeDefined()
      expect(dashboardAppointments.Route.options.component).toBeDefined()
    })
  })
})
