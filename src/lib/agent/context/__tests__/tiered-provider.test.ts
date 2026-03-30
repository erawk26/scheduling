import { vi, describe, it, expect, beforeEach } from 'vitest'
import { AgentSearchIndex } from '@/lib/search/search-index'
import type { AgentContext, ScheduleContext, ClientContext, ProfileContext, NotesContext } from '@/lib/agent/context/types'

// Mock the offlinekit module
vi.mock('@/lib/offlinekit', () => ({
  app: {
    appointments: { findMany: vi.fn() },
    clients: { findMany: vi.fn() },
    services: { findMany: vi.fn() },
    pets: { findMany: vi.fn() },
    agentProfile: { findMany: vi.fn() },
    agentNotes: { findMany: vi.fn() },
  },
}))

import { app } from '@/lib/offlinekit'
import { TieredContextProvider } from '@/lib/agent/context/tiered-provider'

const mockApp = app as unknown as {
  appointments: { findMany: ReturnType<typeof vi.fn> }
  clients: { findMany: ReturnType<typeof vi.fn> }
  services: { findMany: ReturnType<typeof vi.fn> }
  pets: { findMany: ReturnType<typeof vi.fn> }
  agentProfile: { findMany: ReturnType<typeof vi.fn> }
  agentNotes: { findMany: ReturnType<typeof vi.fn> }
}

const NOW = new Date('2026-03-29T12:00:00')

function makeAppointment(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'apt-1',
    client_id: 'c-1',
    service_id: 's-1',
    start_time: '2026-03-28T09:00:00',
    end_time: '2026-03-28T10:00:00',
    status: 'confirmed',
    address: '123 Main St',
    notes: null,
    weather_alert: 0,
    ...overrides,
  }
}

function makeClient(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    id: 'c-1',
    first_name: 'Jane',
    last_name: 'Smith',
    email: 'jane@example.com',
    phone: null,
    address: '123 Main St',
    scheduling_flexibility: 'flexible',
    notes: null,
    ...overrides,
  }
}

function makeService() {
  return { id: 's-1', name: 'Bath & Groom' }
}

function makeProfile() {
  return { section_id: 'business-rules', content: { hours: '9-5' } }
}

function makeNote() {
  return {
    id: 'note-1',
    summary: 'Jane prefers mornings',
    content: 'Detailed note',
    tags: ['preference'],
    date_ref: '2026-03-28T00:00:00',
    client_id: 'c-1',
  }
}

beforeEach(() => {
  vi.setSystemTime(NOW)
  mockApp.appointments.findMany.mockResolvedValue([])
  mockApp.clients.findMany.mockResolvedValue([])
  mockApp.services.findMany.mockResolvedValue([])
  mockApp.pets.findMany.mockResolvedValue([])
  mockApp.agentProfile.findMany.mockResolvedValue([])
  mockApp.agentNotes.findMany.mockResolvedValue([])
})

describe('TieredContextProvider', () => {
  describe('L0: Always include profile', () => {
    it('always includes profile sections regardless of query', async () => {
      mockApp.agentProfile.findMany.mockResolvedValue([makeProfile()])
      const index = new AgentSearchIndex()
      const provider = new TieredContextProvider(index)

      const ctx = await provider.getFullContext('random unrelated query xyz')

      expect(ctx.profile).toBeDefined()
      expect(ctx.profile!.sections).toHaveLength(1)
      expect(ctx.profile!.sections[0]!.section_id).toBe('business-rules')
    })
  })

  describe('L0: Always include recent appointments', () => {
    it('always returns appointments within last 7 days regardless of query', async () => {
      const recentApt = makeAppointment({ id: 'apt-recent', start_time: '2026-03-25T09:00:00', end_time: '2026-03-25T10:00:00' })
      const oldApt = makeAppointment({ id: 'apt-old', start_time: '2026-01-01T09:00:00', end_time: '2026-01-01T10:00:00' })
      mockApp.appointments.findMany.mockResolvedValue([recentApt, oldApt])
      mockApp.clients.findMany.mockResolvedValue([makeClient()])
      mockApp.services.findMany.mockResolvedValue([makeService()])
      const index = new AgentSearchIndex()
      const provider = new TieredContextProvider(index)

      const ctx = await provider.getFullContext('hello')

      expect(ctx.schedule).toBeDefined()
      const ids = ctx.schedule!.appointments.map((a) => a.id)
      expect(ids).toContain('apt-recent')
      expect(ids).not.toContain('apt-old')
    })

    it('includes appointments up to 14 days in the future', async () => {
      const futureApt = makeAppointment({ id: 'apt-future', start_time: '2026-04-04T09:00:00', end_time: '2026-04-04T10:00:00' })
      const nextWeekApt = makeAppointment({ id: 'apt-nextweek', start_time: '2026-04-10T09:00:00', end_time: '2026-04-10T10:00:00' })
      const farFutureApt = makeAppointment({ id: 'apt-far', start_time: '2026-05-01T09:00:00', end_time: '2026-05-01T10:00:00' })
      mockApp.appointments.findMany.mockResolvedValue([futureApt, nextWeekApt, farFutureApt])
      mockApp.clients.findMany.mockResolvedValue([makeClient()])
      mockApp.services.findMany.mockResolvedValue([makeService()])
      const index = new AgentSearchIndex()
      const provider = new TieredContextProvider(index)

      const ctx = await provider.getFullContext('what is on my schedule')

      const ids = ctx.schedule!.appointments.map((a) => a.id)
      expect(ids).toContain('apt-future')
      expect(ids).toContain('apt-nextweek')
      expect(ids).not.toContain('apt-far')
    })

    it('sees a full week of appointments when asked on Sunday (the +7 day bug)', async () => {
      // Simulate: today is Sunday March 29, user asks about next week (Mon Apr 6 - Fri Apr 10)
      // Old bug: +7 days only reached Apr 5, missing the entire next week
      const mondayApt = makeAppointment({ id: 'apt-mon', start_time: '2026-04-06T09:00:00', end_time: '2026-04-06T10:00:00' })
      const wednesdayApt = makeAppointment({ id: 'apt-wed', start_time: '2026-04-08T14:00:00', end_time: '2026-04-08T15:00:00' })
      const fridayApt = makeAppointment({ id: 'apt-fri', start_time: '2026-04-10T10:00:00', end_time: '2026-04-10T11:00:00' })
      mockApp.appointments.findMany.mockResolvedValue([mondayApt, wednesdayApt, fridayApt])
      mockApp.clients.findMany.mockResolvedValue([makeClient()])
      mockApp.services.findMany.mockResolvedValue([makeService()])
      const index = new AgentSearchIndex()
      const provider = new TieredContextProvider(index)

      const ctx = await provider.getFullContext("what's my next week look like")

      const ids = ctx.schedule!.appointments.map((a) => a.id)
      expect(ids).toContain('apt-mon')
      expect(ids).toContain('apt-wed')
      expect(ids).toContain('apt-fri')
      expect(ids).toHaveLength(3)
    })
  })

  describe('L1: BM25 search results included in context', () => {
    it('includes notes matched by search query via L1', async () => {
      mockApp.agentNotes.findMany.mockResolvedValue([makeNote()])
      const index = new AgentSearchIndex()
      index.addDocuments('agentNotes', [
        { id: 'note-1', collection: 'agentNotes', text: 'Jane prefers mornings preference' },
      ])
      const provider = new TieredContextProvider(index)

      const ctx = await provider.getFullContext('Jane morning preference')

      expect(ctx.notes).toBeDefined()
      const noteIds = ctx.notes!.notes.map((n) => n.id)
      expect(noteIds).toContain('note-1')
    })

    it('includes clients matched by search query via L1', async () => {
      mockApp.clients.findMany.mockResolvedValue([makeClient()])
      mockApp.pets.findMany.mockResolvedValue([])
      const index = new AgentSearchIndex()
      index.addDocuments('clients', [
        { id: 'c-1', collection: 'clients', text: 'Jane Smith grooming flexible' },
      ])
      const provider = new TieredContextProvider(index)

      const ctx = await provider.getFullContext('Jane Smith client')

      expect(ctx.clients).toBeDefined()
      const clientIds = ctx.clients!.clients.map((c) => c.id)
      expect(clientIds).toContain('c-1')
    })
  })

  describe('L1: Deduplication against L0', () => {
    it('does not duplicate appointments that are in both L0 and L1 search results', async () => {
      const apt = makeAppointment()
      mockApp.appointments.findMany.mockResolvedValue([apt])
      mockApp.clients.findMany.mockResolvedValue([makeClient()])
      mockApp.services.findMany.mockResolvedValue([makeService()])
      const index = new AgentSearchIndex()
      index.addDocuments('appointments', [
        { id: 'apt-1', collection: 'appointments', text: 'Jane Bath Groom confirmed' },
      ])
      const provider = new TieredContextProvider(index)

      const ctx = await provider.getFullContext('appointment scheduled')

      const ids = ctx.schedule!.appointments.map((a) => a.id)
      const unique = new Set(ids)
      expect(ids.length).toBe(unique.size)
    })
  })

  describe('L2: Graceful degradation', () => {
    it('returns valid context (L0+L1) when L2 is not available', async () => {
      mockApp.agentProfile.findMany.mockResolvedValue([makeProfile()])
      const index = new AgentSearchIndex()
      const provider = new TieredContextProvider(index)

      const ctx = await provider.getFullContext('test query')

      // Should not throw, should return valid AgentContext shape
      expect(ctx).toHaveProperty('query', 'test query')
      expect(ctx.profile).toBeDefined()
    })
  })

  describe('getFullContext returns valid AgentContext shape', () => {
    it('always returns an object with query field', async () => {
      const index = new AgentSearchIndex()
      const provider = new TieredContextProvider(index)

      const ctx = await provider.getFullContext('anything')

      expect(ctx.query).toBe('anything')
    })

    it('returns undefined optional fields when no data exists', async () => {
      const index = new AgentSearchIndex()
      const provider = new TieredContextProvider(index)

      const ctx: AgentContext = await provider.getFullContext('something')

      // schedule should be defined but with empty appointments (L0 always runs)
      expect(ctx.schedule).toBeDefined()
      expect(ctx.schedule!.appointments).toHaveLength(0)
      // profile should be defined with empty sections
      expect(ctx.profile).toBeDefined()
      expect(ctx.profile!.sections).toHaveLength(0)
    })
  })

  describe('Query with no search results still returns L0', () => {
    it('returns profile and recent appointments even when search returns nothing', async () => {
      mockApp.agentProfile.findMany.mockResolvedValue([makeProfile()])
      mockApp.appointments.findMany.mockResolvedValue([makeAppointment()])
      mockApp.clients.findMany.mockResolvedValue([makeClient()])
      mockApp.services.findMany.mockResolvedValue([makeService()])
      const index = new AgentSearchIndex()
      // No documents indexed — search returns nothing
      const provider = new TieredContextProvider(index)

      const ctx = await provider.getFullContext('zzzznotfoundxxx')

      expect(ctx.profile!.sections).toHaveLength(1)
      expect(ctx.schedule!.appointments).toHaveLength(1)
    })
  })

  describe('Individual methods', () => {
    it('getScheduleContext returns appointments in dateRange', async () => {
      const apt = makeAppointment()
      mockApp.appointments.findMany.mockResolvedValue([apt])
      mockApp.clients.findMany.mockResolvedValue([makeClient()])
      mockApp.services.findMany.mockResolvedValue([makeService()])
      const index = new AgentSearchIndex()
      const provider = new TieredContextProvider(index)

      const result: ScheduleContext = await provider.getScheduleContext({
        from: '2026-03-28T00:00:00',
        to: '2026-03-28T23:59:59',
      })

      expect(result.appointments).toHaveLength(1)
      expect(result.appointments[0]!.id).toBe('apt-1')
      expect(result.appointments[0]!.clientName).toBe('Jane Smith')
      expect(result.appointments[0]!.serviceName).toBe('Bath & Groom')
    })

    it('getClientContext returns all clients with pets', async () => {
      mockApp.clients.findMany.mockResolvedValue([makeClient()])
      mockApp.pets.findMany.mockResolvedValue([
        { id: 'pet-1', client_id: 'c-1', name: 'Buddy', species: 'dog', breed: 'Labrador', behavior_notes: null },
      ])
      const index = new AgentSearchIndex()
      const provider = new TieredContextProvider(index)

      const result: ClientContext = await provider.getClientContext()

      expect(result.clients).toHaveLength(1)
      expect(result.clients[0]!.pets).toHaveLength(1)
      expect(result.clients[0]!.pets[0]!.name).toBe('Buddy')
    })

    it('getClientContext filters by clientId', async () => {
      mockApp.clients.findMany.mockResolvedValue([makeClient(), makeClient({ id: 'c-2', first_name: 'Bob' })])
      mockApp.pets.findMany.mockResolvedValue([])
      const index = new AgentSearchIndex()
      const provider = new TieredContextProvider(index)

      const result: ClientContext = await provider.getClientContext('c-1')

      expect(result.clients).toHaveLength(1)
      expect(result.clients[0]!.id).toBe('c-1')
    })

    it('getProfileContext returns all sections when no filter', async () => {
      mockApp.agentProfile.findMany.mockResolvedValue([makeProfile(), { section_id: 'bootstrap', content: {} }])
      const index = new AgentSearchIndex()
      const provider = new TieredContextProvider(index)

      const result: ProfileContext = await provider.getProfileContext()

      expect(result.sections).toHaveLength(2)
    })

    it('getProfileContext filters by section ids', async () => {
      mockApp.agentProfile.findMany.mockResolvedValue([makeProfile(), { section_id: 'bootstrap', content: {} }])
      const index = new AgentSearchIndex()
      const provider = new TieredContextProvider(index)

      const result: ProfileContext = await provider.getProfileContext(['bootstrap'])

      expect(result.sections).toHaveLength(1)
      expect(result.sections[0]!.section_id).toBe('bootstrap')
    })

    it('getNotesContext returns filtered notes by keywords', async () => {
      mockApp.agentNotes.findMany.mockResolvedValue([makeNote(), { id: 'note-2', summary: 'unrelated topic', content: null, tags: [], date_ref: null, client_id: null }])
      const index = new AgentSearchIndex()
      const provider = new TieredContextProvider(index)

      const result: NotesContext = await provider.getNotesContext(undefined, ['mornings'])

      expect(result.notes).toHaveLength(1)
      expect(result.notes[0]!.id).toBe('note-1')
    })
  })
})
