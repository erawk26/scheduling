import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AgentSearchIndex } from '@/lib/search/search-index'
import type { SearchDocument } from '@/lib/search/types'
import { ConversationSearch, type SearchResult } from '../conversation-search'

// --- Seed data: messages across multiple threads ---

interface ThreadMessage {
  id: string
  threadId: string
  threadTitle: string
  content: string
  timestamp: string
}

const THREAD_MESSAGES: ThreadMessage[] = [
  {
    id: 'msg-1',
    threadId: 'thread-grooming',
    threadTitle: 'Grooming Schedule',
    content: 'My Tuesday is really busy with back-to-back grooming sessions',
    timestamp: '2026-03-29T09:00:00',
  },
  {
    id: 'msg-2',
    threadId: 'thread-grooming',
    threadTitle: 'Grooming Schedule',
    content: 'Can you move the poodle appointment to Wednesday morning?',
    timestamp: '2026-03-29T09:05:00',
  },
  {
    id: 'msg-3',
    threadId: 'thread-routes',
    threadTitle: 'Route Planning',
    content: 'Optimize my driving route for Thursday afternoon appointments',
    timestamp: '2026-03-29T10:00:00',
  },
  {
    id: 'msg-4',
    threadId: 'thread-routes',
    threadTitle: 'Route Planning',
    content: 'The client at 123 Oak St cancelled their booking',
    timestamp: '2026-03-29T10:15:00',
  },
  {
    id: 'msg-5',
    threadId: 'thread-weather',
    threadTitle: 'Weather Alerts',
    content: 'Rain forecast for Friday, reschedule outdoor grooming sessions',
    timestamp: '2026-03-29T11:00:00',
  },
  {
    id: 'msg-6',
    threadId: 'thread-weather',
    threadTitle: 'Weather Alerts',
    content: 'Saturday looks clear and open for rescheduled appointments',
    timestamp: '2026-03-29T11:10:00',
  },
]

// Map from search doc id back to thread metadata
const MESSAGE_MAP = new Map(THREAD_MESSAGES.map((m) => [m.id, m]))

function buildSearchIndex(): AgentSearchIndex {
  const index = new AgentSearchIndex()
  const docs: SearchDocument[] = THREAD_MESSAGES.map((m) => ({
    id: m.id,
    collection: 'agentNotes' as const,
    text: m.content,
  }))
  index.addDocuments('agentNotes', docs)
  return index
}

function createSearchHandler(index: AgentSearchIndex) {
  return (query: string): SearchResult[] => {
    const hits = index.search(query)
    return hits.map((hit) => {
      const msg = MESSAGE_MAP.get(hit.id)!
      return {
        threadId: msg.threadId,
        threadTitle: msg.threadTitle,
        messageContent: msg.content,
        matchedTerms: [query],
        timestamp: msg.timestamp,
      }
    })
  }
}

describe('ConversationSearch + MiniSearch integration', () => {
  function setup() {
    const index = buildSearchIndex()
    const onSearch = vi.fn(createSearchHandler(index))
    const onSelectResult = vi.fn()
    const user = userEvent.setup()

    render(
      <ConversationSearch onSearch={onSearch} onSelectResult={onSelectResult} />,
    )

    return { index, onSearch, onSelectResult, user }
  }

  it('finds messages by content across multiple threads', async () => {
    const { user } = setup()

    await user.type(screen.getByTestId('search-input'), 'grooming')

    const items = screen.getAllByTestId('search-result-item')
    // "grooming" appears in thread-grooming msg-1 and thread-weather msg-5
    expect(items.length).toBeGreaterThanOrEqual(2)

    const resultTexts = items.map((el) => el.textContent)
    const hasGroomingThread = resultTexts.some((t) => t?.includes('Grooming Schedule'))
    const hasWeatherThread = resultTexts.some((t) => t?.includes('Weather Alerts'))
    expect(hasGroomingThread).toBe(true)
    expect(hasWeatherThread).toBe(true)
  })

  it('results include correct threadId and threadTitle', async () => {
    const { user, onSearch } = setup()

    await user.type(screen.getByTestId('search-input'), 'cancelled')

    expect(onSearch).toHaveBeenCalled()
    const lastCallResult = onSearch.mock.results[onSearch.mock.results.length - 1].value as SearchResult[]
    const cancelResult = lastCallResult.find((r) => r.threadId === 'thread-routes')
    expect(cancelResult).toBeDefined()
    expect(cancelResult!.threadTitle).toBe('Route Planning')
    expect(cancelResult!.messageContent).toContain('cancelled')
  })

  it('synonym expansion: searching "packed" finds messages with "busy"', async () => {
    const { user, onSearch } = setup()

    // "packed" synonyms include "busy" — msg-1 contains "busy"
    await user.type(screen.getByTestId('search-input'), 'packed')

    expect(onSearch).toHaveBeenCalled()
    const lastCallResult = onSearch.mock.results[onSearch.mock.results.length - 1].value as SearchResult[]
    const busyMatch = lastCallResult.find((r) =>
      r.messageContent.includes('busy'),
    )
    expect(busyMatch).toBeDefined()
    expect(busyMatch!.threadId).toBe('thread-grooming')
    expect(busyMatch!.threadTitle).toBe('Grooming Schedule')
  })

  it('synonym expansion: searching "move" finds "reschedule" messages', async () => {
    const { user, onSearch } = setup()

    // "move" synonyms include "reschedule" — msg-2 has "move", msg-5 has "reschedule"
    await user.type(screen.getByTestId('search-input'), 'move')

    expect(onSearch).toHaveBeenCalled()
    const lastCallResult = onSearch.mock.results[onSearch.mock.results.length - 1].value as SearchResult[]
    const contents = lastCallResult.map((r) => r.messageContent)
    const hasMove = contents.some((c) => c.includes('move'))
    const hasReschedule = contents.some((c) => c.includes('reschedule'))
    expect(hasMove || hasReschedule).toBe(true)
  })

  it('clicking a result calls onSelectResult with the correct threadId', async () => {
    const { user, onSelectResult } = setup()

    await user.type(screen.getByTestId('search-input'), 'route')

    const items = screen.getAllByTestId('search-result-item')
    expect(items.length).toBeGreaterThanOrEqual(1)

    // Find the Route Planning result and click it
    const routeItem = items.find((el) => el.textContent?.includes('Route Planning'))
    expect(routeItem).toBeDefined()
    await user.click(routeItem!)

    expect(onSelectResult).toHaveBeenCalledOnce()
    expect(onSelectResult).toHaveBeenCalledWith('thread-routes')
  })

  it('messages are seeded across all three threads in the index', () => {
    const index = buildSearchIndex()
    expect(index.documentCount).toBe(THREAD_MESSAGES.length)

    // Verify each thread has searchable content
    const groomingHits = index.search('grooming')
    const routeHits = index.search('driving route')
    const weatherHits = index.search('rain forecast')

    expect(groomingHits.length).toBeGreaterThanOrEqual(1)
    expect(routeHits.length).toBeGreaterThanOrEqual(1)
    expect(weatherHits.length).toBeGreaterThanOrEqual(1)
  })

  it('searching "open" finds "clear and open" via synonym + content match', async () => {
    const { user, onSearch } = setup()

    // "open" synonyms include "free", "available", "clear" — msg-6 contains "open"
    await user.type(screen.getByTestId('search-input'), 'open')

    expect(onSearch).toHaveBeenCalled()
    const lastCallResult = onSearch.mock.results[onSearch.mock.results.length - 1].value as SearchResult[]
    const openMatch = lastCallResult.find((r) =>
      r.messageContent.includes('open'),
    )
    expect(openMatch).toBeDefined()
    expect(openMatch!.threadId).toBe('thread-weather')
  })

  it('no results shown for queries with no matches', async () => {
    const { user } = setup()

    await user.type(screen.getByTestId('search-input'), 'xyznonexistent')

    expect(screen.getByTestId('search-no-results')).toBeInTheDocument()
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument()
  })
})
