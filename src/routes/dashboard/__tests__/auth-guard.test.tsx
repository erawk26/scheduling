/**
 * INT: Auth Guard Integration Test
 *
 * Tests the cookie-based beforeLoad redirect in dashboard.tsx:
 * - No cookie -> throws redirect to /sign-in
 * - Valid cookie present -> does not redirect
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

const SESSION_COOKIE = 'better-auth.session_token'

// Extract the beforeLoad logic by importing the route module
// We test the options.beforeLoad function directly

async function getBeforeLoad() {
  const mod = await import('@/routes/dashboard.tsx')
  return mod.Route.options.beforeLoad as () => void
}

function clearCookies() {
  // Clear all cookies by setting them expired
  document.cookie.split(';').forEach((cookie) => {
    const name = cookie.split('=')[0].trim()
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
  })
}

describe('Auth Guard - dashboard.tsx beforeLoad (INT)', () => {
  beforeEach(() => {
    clearCookies()
  })

  afterEach(() => {
    clearCookies()
  })

  it('throws a redirect to /sign-in when no session cookie is present', async () => {
    const beforeLoad = await getBeforeLoad()

    // Ensure no session cookie
    expect(document.cookie).not.toContain(SESSION_COOKIE)

    let thrown: unknown
    try {
      beforeLoad()
    } catch (e) {
      thrown = e
    }

    // TanStack Router redirect throws a Response with options.to
    expect(thrown).toBeDefined()
    expect(thrown).toBeInstanceOf(Response)
    expect((thrown as Response & { options: { to: string } }).options).toMatchObject({ to: '/sign-in' })
  })

  it('does not throw when the session cookie is present', async () => {
    // Set the session cookie
    document.cookie = `${SESSION_COOKIE}=test-token-value; path=/`
    expect(document.cookie).toContain(SESSION_COOKIE)

    const beforeLoad = await getBeforeLoad()

    // Should not throw
    expect(() => beforeLoad()).not.toThrow()
  })

  it('does not throw when cookie string contains session token among other cookies', async () => {
    document.cookie = `other-cookie=foo; path=/`
    document.cookie = `${SESSION_COOKIE}=abc123; path=/`
    document.cookie = `another=bar; path=/`

    const beforeLoad = await getBeforeLoad()

    expect(() => beforeLoad()).not.toThrow()
  })
})
