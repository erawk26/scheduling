import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatSettings } from '../chat-settings'

describe('ChatSettings', () => {
  it('renders settings shortcut when onOpenSettings provided', () => {
    render(<ChatSettings onResetLearning={vi.fn()} onOpenSettings={vi.fn()} />)
    expect(screen.getByTestId('settings-shortcut')).toBeInTheDocument()
  })

  it('hides settings shortcut when onOpenSettings not provided', () => {
    render(<ChatSettings onResetLearning={vi.fn()} />)
    expect(screen.queryByTestId('settings-shortcut')).not.toBeInTheDocument()
  })

  it('calls onOpenSettings when settings icon clicked', () => {
    const onOpen = vi.fn()
    render(<ChatSettings onResetLearning={vi.fn()} onOpenSettings={onOpen} />)
    fireEvent.click(screen.getByTestId('settings-shortcut'))
    expect(onOpen).toHaveBeenCalledOnce()
  })

  it('renders reset learning trigger', () => {
    render(<ChatSettings onResetLearning={vi.fn()} />)
    expect(screen.getByTestId('reset-learning-trigger')).toBeInTheDocument()
  })

  it('shows confirmation dialog when reset clicked', () => {
    render(<ChatSettings onResetLearning={vi.fn()} />)
    fireEvent.click(screen.getByTestId('reset-learning-trigger'))
    expect(screen.getByText('Reset learned data?')).toBeInTheDocument()
  })

  it('calls onResetLearning when confirmed', async () => {
    const onReset = vi.fn().mockResolvedValue(undefined)
    render(<ChatSettings onResetLearning={onReset} />)
    fireEvent.click(screen.getByTestId('reset-learning-trigger'))
    fireEvent.click(screen.getByTestId('confirm-reset'))
    await waitFor(() => {
      expect(onReset).toHaveBeenCalledOnce()
    })
  })

  it('shows success message after reset', async () => {
    const onReset = vi.fn().mockResolvedValue(undefined)
    render(<ChatSettings onResetLearning={onReset} />)
    fireEvent.click(screen.getByTestId('reset-learning-trigger'))
    fireEvent.click(screen.getByTestId('confirm-reset'))
    await waitFor(() => {
      expect(screen.getByTestId('reset-success')).toBeInTheDocument()
    })
  })

  it('has data-testid="chat-settings"', () => {
    render(<ChatSettings onResetLearning={vi.fn()} />)
    expect(screen.getByTestId('chat-settings')).toBeInTheDocument()
  })
})
