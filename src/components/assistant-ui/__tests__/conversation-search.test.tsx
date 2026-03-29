import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ConversationSearch, SearchResult } from '../conversation-search'

const mockResults: SearchResult[] = [
  {
    threadId: 'thread-1',
    threadTitle: 'Grooming schedule',
    messageContent: 'Schedule the appointment for next Monday',
    matchedTerms: ['schedule', 'appointment'],
    timestamp: '2026-03-29T10:00:00',
  },
  {
    threadId: 'thread-2',
    threadTitle: 'Weather check',
    messageContent: 'What is the weather like today?',
    matchedTerms: ['weather'],
    timestamp: '2026-03-29T11:00:00',
  },
]

describe('ConversationSearch', () => {
  it('renders search input', () => {
    render(<ConversationSearch onSearch={vi.fn(() => [])} onSelectResult={vi.fn()} />)
    expect(screen.getByTestId('search-input')).toBeInTheDocument()
  })

  it('has data-testid conversation-search', () => {
    render(<ConversationSearch onSearch={vi.fn(() => [])} onSelectResult={vi.fn()} />)
    expect(screen.getByTestId('conversation-search')).toBeInTheDocument()
  })

  it('does not show results with empty query', () => {
    render(<ConversationSearch onSearch={vi.fn(() => mockResults)} onSelectResult={vi.fn()} />)
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument()
    expect(screen.queryByTestId('search-no-results')).not.toBeInTheDocument()
  })

  it('does not show results with single character query', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn(() => mockResults)
    render(<ConversationSearch onSearch={onSearch} onSelectResult={vi.fn()} />)
    await user.type(screen.getByTestId('search-input'), 'a')
    expect(onSearch).not.toHaveBeenCalled()
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument()
  })

  it('calls onSearch when query is 2 or more characters', async () => {
    const user = userEvent.setup()
    const onSearch = vi.fn(() => [])
    render(<ConversationSearch onSearch={onSearch} onSelectResult={vi.fn()} />)
    await user.type(screen.getByTestId('search-input'), 'sc')
    expect(onSearch).toHaveBeenCalledWith('sc')
  })

  it('shows results when onSearch returns matches', async () => {
    const user = userEvent.setup()
    render(<ConversationSearch onSearch={vi.fn(() => mockResults)} onSelectResult={vi.fn()} />)
    await user.type(screen.getByTestId('search-input'), 'schedule')
    expect(screen.getByTestId('search-results')).toBeInTheDocument()
    expect(screen.getAllByTestId('search-result-item')).toHaveLength(2)
  })

  it('shows thread title and message content in each result', async () => {
    const user = userEvent.setup()
    render(<ConversationSearch onSearch={vi.fn(() => mockResults)} onSelectResult={vi.fn()} />)
    await user.type(screen.getByTestId('search-input'), 'schedule')
    expect(screen.getByText('Grooming schedule')).toBeInTheDocument()
    expect(screen.getByText('Weather check')).toBeInTheDocument()
  })

  it('shows no results message when onSearch returns empty array', async () => {
    const user = userEvent.setup()
    render(<ConversationSearch onSearch={vi.fn(() => [])} onSelectResult={vi.fn()} />)
    await user.type(screen.getByTestId('search-input'), 'xyz')
    expect(screen.getByTestId('search-no-results')).toBeInTheDocument()
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument()
  })

  it('calls onSelectResult with threadId when result is clicked', async () => {
    const user = userEvent.setup()
    const onSelectResult = vi.fn()
    render(<ConversationSearch onSearch={vi.fn(() => mockResults)} onSelectResult={onSelectResult} />)
    await user.type(screen.getByTestId('search-input'), 'schedule')
    const items = screen.getAllByTestId('search-result-item')
    await user.click(items[0])
    expect(onSelectResult).toHaveBeenCalledOnce()
    expect(onSelectResult).toHaveBeenCalledWith('thread-1')
  })

  it('clears search when X button is clicked', async () => {
    const user = userEvent.setup()
    render(<ConversationSearch onSearch={vi.fn(() => mockResults)} onSelectResult={vi.fn()} />)
    await user.type(screen.getByTestId('search-input'), 'schedule')
    expect(screen.getByTestId('search-clear')).toBeInTheDocument()
    await user.click(screen.getByTestId('search-clear'))
    expect(screen.getByTestId('search-input')).toHaveValue('')
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument()
  })

  it('clears results after selecting a result', async () => {
    const user = userEvent.setup()
    render(<ConversationSearch onSearch={vi.fn(() => mockResults)} onSelectResult={vi.fn()} />)
    await user.type(screen.getByTestId('search-input'), 'schedule')
    const items = screen.getAllByTestId('search-result-item')
    await user.click(items[0])
    expect(screen.queryByTestId('search-results')).not.toBeInTheDocument()
    expect(screen.getByTestId('search-input')).toHaveValue('')
  })

  it('does not show clear button when query is empty', () => {
    render(<ConversationSearch onSearch={vi.fn(() => [])} onSelectResult={vi.fn()} />)
    expect(screen.queryByTestId('search-clear')).not.toBeInTheDocument()
  })
})
