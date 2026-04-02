import { useState } from 'react'
import { formatDistanceToNow, format } from 'date-fns'

interface MessageTimestampProps {
  timestamp: string
}

export function MessageTimestamp({ timestamp }: MessageTimestampProps) {
  const [showAbsolute, setShowAbsolute] = useState(false)
  const date = new Date(timestamp)

  const relativeTime = formatDistanceToNow(date, { addSuffix: true })
  const absoluteTime = format(date, 'MMM d, h:mm a')

  return (
    <button
      type="button"
      onClick={() => setShowAbsolute((p) => !p)}
      className="text-xs text-muted-foreground hover:text-foreground transition-colors cursor-pointer select-none"
      data-testid="message-timestamp"
    >
      {showAbsolute ? absoluteTime : relativeTime}
    </button>
  )
}
