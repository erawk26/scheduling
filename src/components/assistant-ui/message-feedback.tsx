import { useState } from 'react'
import { ThumbsDown } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MessageFeedbackProps {
  messageId: string
  onFeedback: (messageId: string, type: 'wrong') => void
}

export function MessageFeedback({ messageId, onFeedback }: MessageFeedbackProps) {
  const [submitted, setSubmitted] = useState(false)

  if (submitted) {
    return (
      <span data-testid="feedback-thanks" className="text-xs text-muted-foreground">
        Thanks for the feedback
      </span>
    )
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={() => {
        onFeedback(messageId, 'wrong')
        setSubmitted(true)
      }}
      className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
      data-testid="feedback-button"
    >
      <ThumbsDown className="w-3 h-3 mr-1" />
      This was wrong
    </Button>
  )
}
