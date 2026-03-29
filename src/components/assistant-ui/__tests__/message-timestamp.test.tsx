import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageTimestamp } from '../message-timestamp'

describe('MessageTimestamp', () => {
  const fixedTimestamp = new Date(Date.now() - 2 * 60 * 1000).toISOString() // 2 minutes ago

  it('has data-testid="message-timestamp"', () => {
    render(<MessageTimestamp timestamp={fixedTimestamp} />)
    expect(screen.getByTestId('message-timestamp')).toBeInTheDocument()
  })

  it('renders relative time by default', () => {
    render(<MessageTimestamp timestamp={fixedTimestamp} />)
    const btn = screen.getByTestId('message-timestamp')
    expect(btn.textContent).toMatch(/ago/)
  })

  it('toggles to absolute time on click', async () => {
    const user = userEvent.setup()
    render(<MessageTimestamp timestamp={fixedTimestamp} />)
    const btn = screen.getByTestId('message-timestamp')
    await user.click(btn)
    expect(btn.textContent).not.toMatch(/ago/)
    // absolute format: "MMM d, h:mm a" e.g. "Mar 29, 3:45 PM"
    expect(btn.textContent).toMatch(/\d{1,2}:\d{2}/)
  })

  it('toggles back to relative on second click', async () => {
    const user = userEvent.setup()
    render(<MessageTimestamp timestamp={fixedTimestamp} />)
    const btn = screen.getByTestId('message-timestamp')
    await user.click(btn)
    await user.click(btn)
    expect(btn.textContent).toMatch(/ago/)
  })
})
