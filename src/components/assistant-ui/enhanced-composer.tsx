import { ComposerPrimitive } from '@assistant-ui/react'
import { Send } from 'lucide-react'
import { useState, useCallback } from 'react'
import { cn } from '@/lib/utils'

const CHAR_LIMIT = 1000
const CHAR_WARNING = 900

export function EnhancedComposer() {
  const [charCount, setCharCount] = useState(0)
  const [isEmpty, setIsEmpty] = useState(true)

  const isOverLimit = charCount > CHAR_LIMIT
  const showCounter = charCount >= CHAR_WARNING
  const isDisabled = isOverLimit || isEmpty

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const trimmed = value.trim()
    setIsEmpty(trimmed.length === 0)
    setCharCount(value.length)
  }, [])

  return (
    <ComposerPrimitive.Root className="relative flex items-end gap-2 max-w-3xl mx-auto w-full border border-gray-200 bg-white rounded-2xl px-4 py-3">
      <ComposerPrimitive.Input
        placeholder="Message your AI scheduler..."
        className="flex-1 min-h-[44px] max-h-[6rem] resize-none bg-transparent text-sm focus:outline-none overflow-y-auto"
        rows={1}
        autoFocus
        onChange={handleChange}
      />

      {showCounter && (
        <span
          data-testid="char-counter"
          className={cn(
            'absolute right-16 bottom-4 text-xs tabular-nums',
            isOverLimit ? 'text-red-500 font-medium' : 'text-gray-400',
          )}
        >
          {charCount}/{CHAR_LIMIT}
        </span>
      )}

      <ComposerPrimitive.Send
        disabled={isDisabled}
        className="flex items-center justify-center h-11 w-11 rounded-full bg-primary text-primary-foreground disabled:opacity-30 flex-shrink-0"
      >
        <Send className="w-4 h-4" />
      </ComposerPrimitive.Send>
    </ComposerPrimitive.Root>
  )
}
