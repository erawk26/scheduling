import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import { TypingIndicator } from '../typing-indicator'

describe('TypingIndicator', () => {
  beforeEach(() => { vi.useFakeTimers() })
  afterEach(() => { vi.useRealTimers() })

  it('renders animated dots when isTyping is true', () => {
    render(<TypingIndicator isTyping={true} />)
    expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
  })

  it('does not render when isTyping is false', () => {
    render(<TypingIndicator isTyping={false} />)
    expect(screen.queryByTestId('typing-indicator')).not.toBeInTheDocument()
  })

  it('shows "Thinking..." after 3 seconds', async () => {
    render(<TypingIndicator isTyping={true} />)
    act(() => { vi.advanceTimersByTime(3000) })
    expect(screen.getByText('Thinking...')).toBeInTheDocument()
  })

  it('shows "Still working on this..." after 15 seconds', async () => {
    render(<TypingIndicator isTyping={true} />)
    act(() => { vi.advanceTimersByTime(15000) })
    expect(screen.getByText('Still working on this...')).toBeInTheDocument()
  })

  it('resets status when isTyping changes to false', async () => {
    const { rerender } = render(<TypingIndicator isTyping={true} />)
    act(() => { vi.advanceTimersByTime(5000) })
    rerender(<TypingIndicator isTyping={false} />)
    expect(screen.queryByText('Thinking...')).not.toBeInTheDocument()
  })
})
