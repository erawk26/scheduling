/**
 * Integration tests for GET /api/credits endpoint.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/graphhopper/credit-tracker', () => ({
  creditTracker: {
    getUsage: vi.fn(),
  },
}))

vi.mock('@tanstack/react-router', () => ({
  createFileRoute: vi.fn(() => (config: Record<string, unknown>) => {
    return {
      server: (config as { server: Record<string, unknown> }).server,
    }
  }),
}))

import { creditTracker } from '@/lib/graphhopper/credit-tracker'
import type { Route } from '@/routes/api/credits'

async function getHandler() {
  const mod = await import('../credits.tsx')
  const route = mod.Route as unknown as {
    server: { handlers: { GET: (opts: { request: Request }) => Promise<Response> } }
  }
  return route.server.handlers.GET
}

describe('GET /api/credits', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns 200 with credit usage data', async () => {
    const handler = await getHandler()

    const mockUsage = { used: 250.5, limit: 500, remaining: 249.5, isWarning: false }
    ;(creditTracker.getUsage as ReturnType<typeof vi.fn>).mockReturnValue(mockUsage)

    const response = await handler({ request: new Request('http://localhost:3025/api/credits') })

    expect(response.status).toBe(200)
    expect(response.headers.get('Content-Type')).toContain('application/json')

    const json = (await response.json()) as typeof mockUsage
    expect(json).toEqual(mockUsage)

    expect(creditTracker.getUsage).toHaveBeenCalledTimes(1)
  })

  it('returns warning status when approaching limit', async () => {
    const handler = await getHandler()

    const mockUsage = { used: 450, limit: 500, remaining: 50, isWarning: true }
    ;(creditTracker.getUsage as ReturnType<typeof vi.fn>).mockReturnValue(mockUsage)

    const response = await handler({ request: new Request('http://localhost:3025/api/credits') })

    expect(response.status).toBe(200)
    const json = (await response.json()) as typeof mockUsage
    expect(json.isWarning).toBe(true)
    expect(json.remaining).toBeLessThan(100)
  })

  it('returns zero usage when no credits spent', async () => {
    const handler = await getHandler()

    const mockUsage = { used: 0, limit: 500, remaining: 500, isWarning: false }
    ;(creditTracker.getUsage as ReturnType<typeof vi.fn>).mockReturnValue(mockUsage)

    const response = await handler({ request: new Request('http://localhost:3025/api/credits') })

    expect(response.status).toBe(200)
    const json = (await response.json()) as typeof mockUsage
    expect(json.used).toBe(0)
    expect(json.remaining).toBe(500)
  })
})
