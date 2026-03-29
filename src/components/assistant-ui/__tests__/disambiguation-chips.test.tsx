import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DisambiguationChips } from '../disambiguation-chips'

describe('DisambiguationChips', () => {
  it('renders chips for each option', () => {
    render(<DisambiguationChips options={['Option A', 'Option B', 'Option C']} onSelect={vi.fn()} />)
    expect(screen.getByTestId('disambiguation-chips')).toBeInTheDocument()
    const chips = screen.getAllByTestId('disambiguation-chip')
    expect(chips).toHaveLength(3)
    expect(chips[0]).toHaveTextContent('Option A')
    expect(chips[1]).toHaveTextContent('Option B')
    expect(chips[2]).toHaveTextContent('Option C')
  })

  it('limits to maxOptions (default 3)', () => {
    render(<DisambiguationChips options={['A', 'B', 'C', 'D', 'E']} onSelect={vi.fn()} />)
    expect(screen.getAllByTestId('disambiguation-chip')).toHaveLength(3)
  })

  it('limits to custom maxOptions', () => {
    render(<DisambiguationChips options={['A', 'B', 'C', 'D']} onSelect={vi.fn()} maxOptions={2} />)
    expect(screen.getAllByTestId('disambiguation-chip')).toHaveLength(2)
  })

  it('calls onSelect with the option text when clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<DisambiguationChips options={['Option A', 'Option B']} onSelect={onSelect} />)
    await user.click(screen.getAllByTestId('disambiguation-chip')[1])
    expect(onSelect).toHaveBeenCalledWith('Option B')
  })
})
