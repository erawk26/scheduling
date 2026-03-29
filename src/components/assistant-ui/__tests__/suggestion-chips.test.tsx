import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SuggestionChips } from '../suggestion-chips'

describe('SuggestionChips', () => {
  it('renders default suggestions when none provided', () => {
    render(<SuggestionChips onSelect={vi.fn()} />)
    expect(screen.getByTestId('suggestion-chips')).toBeInTheDocument()
    const chips = screen.getAllByTestId('suggestion-chip')
    expect(chips.length).toBeGreaterThan(0)
  })

  it('renders custom suggestions when provided', () => {
    const custom = [
      { label: 'Custom A', query: 'query a' },
      { label: 'Custom B', query: 'query b' },
    ]
    render(<SuggestionChips suggestions={custom} onSelect={vi.fn()} />)
    expect(screen.getByText('Custom A')).toBeInTheDocument()
    expect(screen.getByText('Custom B')).toBeInTheDocument()
  })

  it('limits chips to maxChips (default 4)', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      label: `Chip ${i}`,
      query: `query ${i}`,
    }))
    render(<SuggestionChips suggestions={many} onSelect={vi.fn()} />)
    expect(screen.getAllByTestId('suggestion-chip')).toHaveLength(4)
  })

  it('respects custom maxChips value', () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      label: `Chip ${i}`,
      query: `query ${i}`,
    }))
    render(<SuggestionChips suggestions={many} onSelect={vi.fn()} maxChips={2} />)
    expect(screen.getAllByTestId('suggestion-chip')).toHaveLength(2)
  })

  it('calls onSelect with query text when clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    const custom = [{ label: 'Ask me', query: 'What is the schedule?' }]
    render(<SuggestionChips suggestions={custom} onSelect={onSelect} />)
    await user.click(screen.getByText('Ask me'))
    expect(onSelect).toHaveBeenCalledOnce()
    expect(onSelect).toHaveBeenCalledWith('What is the schedule?')
  })

  it('does not render when visible is false', () => {
    render(<SuggestionChips onSelect={vi.fn()} visible={false} />)
    expect(screen.queryByTestId('suggestion-chips')).not.toBeInTheDocument()
  })

  it('has data-testid suggestion-chips and suggestion-chip', () => {
    render(<SuggestionChips onSelect={vi.fn()} />)
    expect(screen.getByTestId('suggestion-chips')).toBeInTheDocument()
    expect(screen.getAllByTestId('suggestion-chip').length).toBeGreaterThan(0)
  })

  it('each chip shows its label text', () => {
    const custom = [
      { label: 'Tomorrow', query: 'q1' },
      { label: 'This week', query: 'q2' },
    ]
    render(<SuggestionChips suggestions={custom} onSelect={vi.fn()} />)
    expect(screen.getByText('Tomorrow')).toBeInTheDocument()
    expect(screen.getByText('This week')).toBeInTheDocument()
  })
})
