import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MessageFeedback } from '../message-feedback'

describe('MessageFeedback', () => {
  it('renders "This was wrong" button', () => {
    render(<MessageFeedback messageId="msg-1" onFeedback={vi.fn()} />)
    expect(screen.getByTestId('feedback-button')).toBeInTheDocument()
    expect(screen.getByText('This was wrong')).toBeInTheDocument()
  })

  it('calls onFeedback with messageId and "wrong" when clicked', async () => {
    const user = userEvent.setup()
    const onFeedback = vi.fn()
    render(<MessageFeedback messageId="msg-42" onFeedback={onFeedback} />)
    await user.click(screen.getByTestId('feedback-button'))
    expect(onFeedback).toHaveBeenCalledWith('msg-42', 'wrong')
  })

  it('shows "Thanks for the feedback" after click', async () => {
    const user = userEvent.setup()
    render(<MessageFeedback messageId="msg-1" onFeedback={vi.fn()} />)
    await user.click(screen.getByTestId('feedback-button'))
    expect(screen.getByTestId('feedback-thanks')).toBeInTheDocument()
    expect(screen.getByText('Thanks for the feedback')).toBeInTheDocument()
  })

  it('button disappears after submission', async () => {
    const user = userEvent.setup()
    render(<MessageFeedback messageId="msg-1" onFeedback={vi.fn()} />)
    await user.click(screen.getByTestId('feedback-button'))
    expect(screen.queryByTestId('feedback-button')).not.toBeInTheDocument()
  })
})
