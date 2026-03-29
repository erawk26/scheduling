import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageError } from '../message-error'

describe('MessageError', () => {
  it('renders error message text', () => {
    render(<MessageError error="Something went wrong" />)
    expect(screen.getByText('Something went wrong')).toBeInTheDocument()
  })

  it('has data-testid="message-error"', () => {
    render(<MessageError error="Error" />)
    expect(screen.getByTestId('message-error')).toBeInTheDocument()
  })

  it('shows retry button when onRetry is provided', () => {
    const onRetry = vi.fn()
    render(<MessageError error="Error" onRetry={onRetry} />)
    expect(screen.getByTestId('retry-button')).toBeInTheDocument()
  })

  it('hides retry button when onRetry is not provided', () => {
    render(<MessageError error="Error" />)
    expect(screen.queryByTestId('retry-button')).not.toBeInTheDocument()
  })

  it('calls onRetry when retry button is clicked', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    render(<MessageError error="Error" onRetry={onRetry} />)
    await user.click(screen.getByTestId('retry-button'))
    expect(onRetry).toHaveBeenCalledOnce()
  })
})
