import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { PendingMessage } from '../pending-message'

describe('PendingMessage', () => {
  const defaultProps = {
    content: 'Test message content',
    isStale: false,
    timestamp: '2026-03-29T10:00:00',
  }

  it('renders message content', () => {
    render(<PendingMessage {...defaultProps} />)
    expect(screen.getByText('Test message content')).toBeInTheDocument()
  })

  it('has data-testid="pending-message"', () => {
    render(<PendingMessage {...defaultProps} />)
    expect(screen.getByTestId('pending-message')).toBeInTheDocument()
  })

  it('shows "Will send when online" for non-stale messages', () => {
    render(<PendingMessage {...defaultProps} isStale={false} />)
    expect(screen.getByText('Will send when online')).toBeInTheDocument()
  })

  it('shows stale warning for stale messages', () => {
    render(<PendingMessage {...defaultProps} isStale={true} />)
    expect(screen.getByText('Message stale — queued over 72 hours')).toBeInTheDocument()
  })

  it('does not show "Will send when online" when stale', () => {
    render(<PendingMessage {...defaultProps} isStale={true} />)
    expect(screen.queryByText('Will send when online')).not.toBeInTheDocument()
  })

  it('shows clock icon via svg', () => {
    render(<PendingMessage {...defaultProps} />)
    const container = screen.getByTestId('pending-message')
    expect(container.querySelector('svg')).toBeInTheDocument()
  })
})
