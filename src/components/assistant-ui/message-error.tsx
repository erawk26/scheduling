import { AlertCircle, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MessageErrorProps {
  error: string
  onRetry?: () => void
}

export function MessageError({ error, onRetry }: MessageErrorProps) {
  return (
    <div
      data-testid="message-error"
      className="flex items-center gap-2 px-3 py-2 mt-1 rounded-lg bg-destructive/10 border border-destructive/20 text-sm text-destructive"
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{error}</span>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="h-7 px-2 text-destructive hover:text-destructive hover:bg-destructive/10"
          data-testid="retry-button"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          Retry
        </Button>
      )}
    </div>
  )
}
