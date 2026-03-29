import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NewMessageBadge } from '../new-message-badge'

describe('NewMessageBadge', () => {
  it('renders when visible is true', () => {
    render(<NewMessageBadge visible={true} onClick={() => {}} />)
    expect(screen.getByTestId('new-message-badge')).toBeInTheDocument()
  })

  it('does not render when visible is false', () => {
    render(<NewMessageBadge visible={false} onClick={() => {}} />)
    expect(screen.queryByTestId('new-message-badge')).not.toBeInTheDocument()
  })

  it('shows singular count when count is 1', () => {
    render(<NewMessageBadge visible={true} onClick={() => {}} count={1} />)
    expect(screen.getByTestId('new-message-badge').textContent).toContain('1 new message')
    expect(screen.getByTestId('new-message-badge').textContent).not.toContain('messages')
  })

  it('shows plural count when count is greater than 1', () => {
    render(<NewMessageBadge visible={true} onClick={() => {}} count={3} />)
    expect(screen.getByTestId('new-message-badge').textContent).toContain('3 new messages')
  })

  it('shows fallback text when no count provided', () => {
    render(<NewMessageBadge visible={true} onClick={() => {}} />)
    expect(screen.getByTestId('new-message-badge').textContent).toContain('New messages')
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const handleClick = vi.fn()
    render(<NewMessageBadge visible={true} onClick={handleClick} />)
    await user.click(screen.getByTestId('new-message-badge'))
    expect(handleClick).toHaveBeenCalledOnce()
  })
})
