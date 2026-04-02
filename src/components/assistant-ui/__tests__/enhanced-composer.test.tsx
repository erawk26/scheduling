import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { EnhancedComposer } from '../enhanced-composer'

// Mock @assistant-ui/react so tests run without a runtime context.
// The mock renders plain HTML equivalents so we can test our logic.
vi.mock('@assistant-ui/react', () => ({
  ComposerPrimitive: {
    Root: ({ children, className }: React.PropsWithChildren<{ className?: string }>) => (
      <form className={className} data-testid="composer-root">
        {children}
      </form>
    ),
    Input: ({
      className,
      onChange,
      placeholder,
      rows,
      autoFocus,
    }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
      <textarea
        data-testid="composer-input"
        className={className}
        onChange={onChange}
        placeholder={placeholder}
        rows={rows}
        autoFocus={autoFocus}
      />
    ),
    Send: ({
      children,
      disabled,
      className,
    }: React.PropsWithChildren<{ disabled?: boolean; className?: string }>) => (
      <button
        data-testid="send-button"
        type="submit"
        disabled={disabled}
        className={className}
      >
        {children}
      </button>
    ),
  },
}))

// Minimal React import for the mock JSX above
import React from 'react'

function typeIntoInput(input: HTMLTextAreaElement, value: string) {
  fireEvent.change(input, { target: { value } })
}

describe('EnhancedComposer', () => {
  it('hides char counter below 900 characters', () => {
    render(<EnhancedComposer />)
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    typeIntoInput(input, 'a'.repeat(899))
    expect(screen.queryByTestId('char-counter')).toBeNull()
  })

  it('shows char counter at exactly 900 characters', () => {
    render(<EnhancedComposer />)
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    typeIntoInput(input, 'a'.repeat(900))
    const counter = screen.getByTestId('char-counter')
    expect(counter).toBeInTheDocument()
    expect(counter.textContent).toBe('900/1000')
  })

  it('shows char counter above 900 characters', () => {
    render(<EnhancedComposer />)
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    typeIntoInput(input, 'a'.repeat(950))
    const counter = screen.getByTestId('char-counter')
    expect(counter).toBeInTheDocument()
    expect(counter.textContent).toBe('950/1000')
  })

  it('counter shows red styling when over limit', () => {
    render(<EnhancedComposer />)
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    typeIntoInput(input, 'a'.repeat(1001))
    const counter = screen.getByTestId('char-counter')
    expect(counter.className).toContain('text-destructive')
  })

  it('enables submit at exactly 1000 characters', () => {
    render(<EnhancedComposer />)
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    typeIntoInput(input, 'a'.repeat(1000))
    const btn = screen.getByTestId('send-button')
    expect(btn).not.toBeDisabled()
  })

  it('disables submit at 1001+ characters', () => {
    render(<EnhancedComposer />)
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    typeIntoInput(input, 'a'.repeat(1001))
    const btn = screen.getByTestId('send-button')
    expect(btn).toBeDisabled()
  })

  it('blocks empty messages — send is disabled', () => {
    render(<EnhancedComposer />)
    const btn = screen.getByTestId('send-button')
    expect(btn).toBeDisabled()
  })

  it('blocks whitespace-only messages — send is disabled', () => {
    render(<EnhancedComposer />)
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    typeIntoInput(input, '   \n   ')
    const btn = screen.getByTestId('send-button')
    expect(btn).toBeDisabled()
  })

  it('enables submit with valid non-whitespace content', () => {
    render(<EnhancedComposer />)
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    typeIntoInput(input, 'hello')
    const btn = screen.getByTestId('send-button')
    expect(btn).not.toBeDisabled()
  })

  it('textarea has 4-line max-height class', () => {
    render(<EnhancedComposer />)
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    expect(input.className).toContain('max-h-[6rem]')
  })

  it('textarea has overflow-y-auto for internal scroll', () => {
    render(<EnhancedComposer />)
    const input = screen.getByTestId('composer-input') as HTMLTextAreaElement
    expect(input.className).toContain('overflow-y-auto')
  })
})
