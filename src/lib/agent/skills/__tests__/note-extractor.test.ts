import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockFindMany, mockCreate } = vi.hoisted(() => ({
  mockFindMany: vi.fn().mockResolvedValue([]),
  mockCreate: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('@/lib/offlinekit', () => ({
  app: {
    agentNotes: {
      findMany: mockFindMany,
      create: mockCreate,
    },
  },
}))

import { detectMemoryTypes, extractNote } from '../note-extractor'
import { AgentSearchIndex } from '@/lib/search/search-index'

describe('detectMemoryTypes', () => {
  it('detects scheduling memory type', () => {
    const types = detectMemoryTypes('Can you book an appointment for Monday?', '')
    expect(types).toContain('scheduling')
  })

  it('detects preference memory type', () => {
    const types = detectMemoryTypes('I prefer morning slots', '')
    expect(types).toContain('preference')
  })

  it('detects correction memory type', () => {
    const types = detectMemoryTypes('Actually, I meant next Tuesday not Monday', '')
    expect(types).toContain('correction')
  })

  it('detects learned-fact memory type', () => {
    const types = detectMemoryTypes("FYI, Mrs Johnson's dog is aggressive", '')
    expect(types).toContain('learned-fact')
  })

  it('detects multiple memory types', () => {
    const types = detectMemoryTypes(
      "Actually I prefer morning appointments for this booking",
      ''
    )
    expect(types).toContain('scheduling')
    expect(types).toContain('preference')
    expect(types).toContain('correction')
  })

  it('returns empty array for irrelevant messages', () => {
    const types = detectMemoryTypes('Hello there!', 'Hi, how can I help you today?')
    expect(types).toHaveLength(0)
  })
})

describe('extractNote', () => {
  beforeEach(() => {
    mockFindMany.mockReset()
    mockCreate.mockReset()
    mockFindMany.mockResolvedValue([])
    mockCreate.mockResolvedValue(undefined)
  })

  it('creates note with memory:scheduling tag', async () => {
    await extractNote('Book an appointment for Monday', 'I have scheduled that for you')
    expect(mockCreate).toHaveBeenCalledOnce()
    const created = mockCreate.mock.calls[0]![0] as { tags: string[] }
    expect(created.tags).toContain('memory:scheduling')
  })

  it('creates note with memory:preference tag', async () => {
    await extractNote('I prefer afternoon slots', 'Got it, I will keep that in mind')
    expect(mockCreate).toHaveBeenCalledOnce()
    const created = mockCreate.mock.calls[0]![0] as { tags: string[] }
    expect(created.tags).toContain('memory:preference')
  })

  it('creates note with memory:correction tag', async () => {
    await extractNote('No, that is wrong. I meant Wednesday', 'Apologies, noted for Wednesday')
    expect(mockCreate).toHaveBeenCalledOnce()
    const created = mockCreate.mock.calls[0]![0] as { tags: string[] }
    expect(created.tags).toContain('memory:correction')
  })

  it('skips note when no memory type detected', async () => {
    await extractNote('Hello!', 'Hi there!')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('does not create duplicate notes within 24h', async () => {
    // buildSummary uses first sentence of agent response when >10 chars
    const recentNote = {
      id: 'existing-id',
      summary: 'I have scheduled that for you',
      created_at: new Date().toISOString(),
    }
    mockFindMany.mockResolvedValue([recentNote])

    await extractNote('Book an appointment for Monday', 'I have scheduled that for you')
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('adds document to search index when provided', async () => {
    const searchIndex = new AgentSearchIndex()
    const addDocumentsSpy = vi.spyOn(searchIndex, 'addDocuments')

    await extractNote('Book an appointment for Monday', 'Scheduled', searchIndex)
    expect(addDocumentsSpy).toHaveBeenCalledOnce()
  })

  it('does not throw on error (fire-and-forget)', async () => {
    mockCreate.mockRejectedValue(new Error('DB error'))
    await expect(
      extractNote('Book an appointment for Monday', 'Scheduled')
    ).resolves.not.toThrow()
  })
})
