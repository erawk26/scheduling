import { useState, useEffect } from 'react'
import { Bot } from 'lucide-react'

interface TypingIndicatorProps {
  isTyping: boolean
}

export function TypingIndicator({ isTyping }: TypingIndicatorProps) {
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!isTyping) {
      setStatus(null)
      return
    }

    const thinkingTimer = setTimeout(() => setStatus('Thinking...'), 3000)
    const workingTimer = setTimeout(() => setStatus('Still working on this...'), 15000)

    return () => {
      clearTimeout(thinkingTimer)
      clearTimeout(workingTimer)
    }
  }, [isTyping])

  if (!isTyping) return null

  return (
    <div data-testid="typing-indicator" className="flex items-end gap-2">
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-secondary flex-shrink-0">
        <Bot className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-1 items-start">
        <div className="px-4 py-2.5 rounded-2xl rounded-bl-sm bg-secondary flex items-center gap-1">
          <span className="flex gap-1">
            <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '0ms' }} />
            <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '150ms' }} />
            <span className="w-2 h-2 rounded-full bg-muted-foreground animate-bounce" style={{ animationDelay: '300ms' }} />
          </span>
        </div>
        {status && (
          <span className="text-xs text-muted-foreground px-2">{status}</span>
        )}
      </div>
    </div>
  )
}
