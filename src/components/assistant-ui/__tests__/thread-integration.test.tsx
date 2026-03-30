import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Thread } from '../thread'

// Mock the individual enhanced UI components that Thread uses
vi.mock('../enhanced-composer', () => ({
  EnhancedComposer: () => (
    <div data-testid="enhanced-composer">
      <textarea data-testid="composer-input" placeholder="Message your AI scheduler..." />
      <button data-testid="send-button" disabled>Send</button>
      <span data-testid="char-counter">0/1000</span>
    </div>
  ),
}))

vi.mock('../typing-indicator', () => ({
  TypingIndicator: () => <div data-testid="typing-indicator" />,
}))

vi.mock('../message-timestamp', () => ({
  MessageTimestamp: () => <button data-testid="message-timestamp" />,
}))

vi.mock('../new-message-badge', () => ({
  NewMessageBadge: () => <div data-testid="new-message-badge" />,
}))

// Mock @assistant-ui/react primitives
vi.mock('@assistant-ui/react', () => ({
  ThreadPrimitive: {
    Root: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="thread-root" className={className}>
        {children}
      </div>
    ),
    Viewport: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="thread-viewport" className={className} style={{ height: '400px', overflow: 'auto' }}>
        {children}
      </div>
    ),
    ViewportFooter: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <div data-testid="thread-viewport-footer" className={className}>
        {children}
      </div>
    ),
    Messages: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="thread-messages">{children}</div>
    ),
    Message: ({ children, role }: { children: React.ReactNode; role: string }) => (
      <div data-testid={`message-${role}`}>{children}</div>
    ),
    Parts: () => <div data-testid="message-parts" />,
  },
  AuiIf: ({ condition, children }: { condition: () => boolean; children: React.ReactNode }) => {
    // Return children unconditionally for simplicity - we're testing composition not conditional logic
    return <>{children}</>
  },
  ComposerPrimitive: {
    Root: ({ children, className }: { children: React.ReactNode; className?: string }) => (
      <form data-testid="composer-root" className={className}>
        {children}
      </form>
    ),
    Input: (props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) => (
      <textarea data-testid="composer-input" {...props} />
    ),
    Send: ({ children, disabled }: { children: React.ReactNode; disabled?: boolean }) => (
      <button data-testid="send-button" type="submit" disabled={disabled}>
        {children}
      </button>
    ),
  },
  AssistantRuntimeProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="runtime-provider">{children}</div>
  ),
  useLocalRuntime: () => ({}),
}))

describe('Thread Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('Component Composition', () => {
    it('renders Thread with proper structure', () => {
      render(<Thread />)
      expect(screen.getByTestId('thread-root')).toBeInTheDocument()
      expect(screen.getByTestId('thread-viewport')).toBeInTheDocument()
      expect(screen.getByTestId('thread-viewport-footer')).toBeInTheDocument()
      expect(screen.getByTestId('thread-messages')).toBeInTheDocument()
    })

    it('includes EnhancedComposer', () => {
      render(<Thread />)
      expect(screen.getByTestId('enhanced-composer')).toBeInTheDocument()
      expect(screen.getByTestId('composer-input')).toBeInTheDocument()
      expect(screen.getByTestId('send-button')).toBeInTheDocument()
    })

    it('renders empty state with bot icon and suggestions', () => {
      render(<Thread />)
      expect(screen.getByText(/How can I help with your schedule\?/i)).toBeInTheDocument()
    })

    it('includes NewMessageBadge', () => {
      render(<Thread />)
      expect(screen.getByTestId('new-message-badge')).toBeInTheDocument()
    })

    it('includes TypingIndicator', () => {
      render(<Thread />)
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
    })
  })

  describe('EnhancedComposer Integration', () => {
    it('allows typing in the composer', async () => {
      const user = userEvent.setup()
      render(<Thread />)
      const input = screen.getByTestId('composer-input')
      await user.type(input, 'Hello')
      expect(input).toHaveValue('Hello')
    })

    it('has character counter', () => {
      render(<Thread />)
      expect(screen.getByTestId('char-counter')).toHaveTextContent('0/1000')
    })

    it('send button starts disabled', () => {
      render(<Thread />)
      expect(screen.getByTestId('send-button')).toBeDisabled()
    })
  })

  describe('ResizeObserver Polyfill', () => {
    it('ResizeObserver is available globally', () => {
      expect(typeof ResizeObserver).toBe('function')
    })

    it('ResizeObserver can be used without errors', () => {
      const observer = new ResizeObserver(() => {})
      observer.observe(document.createElement('div'))
      observer.unobserve(document.createElement('div'))
      observer.disconnect()
    })
  })

  describe('PRD Acceptance Criteria', () => {
    it('Thread renders with proper structure', () => {
      render(<Thread />)
      expect(screen.getByTestId('thread-root')).toBeInTheDocument()
    })

    it('EnhancedComposer is used (has char-counter unique to EnhancedComposer)', () => {
      render(<Thread />)
      // EnhancedComposer includes a character counter that ComposerPrimitive doesn't have
      expect(screen.getByTestId('char-counter')).toBeInTheDocument()
      expect(screen.getByTestId('composer-input')).toBeInTheDocument()
    })

    it('TypingIndicator component is included', () => {
      render(<Thread />)
      expect(screen.getByTestId('typing-indicator')).toBeInTheDocument()
    })

    it('NewMessageBadge component is included', () => {
      render(<Thread />)
      expect(screen.getByTestId('new-message-badge')).toBeInTheDocument()
    })

    it('ResizeObserver polyfill works in jsdom', () => {
      expect(typeof ResizeObserver).toBe('function')
      const observer = new ResizeObserver(() => {})
      observer.disconnect()
    })
  })
})
