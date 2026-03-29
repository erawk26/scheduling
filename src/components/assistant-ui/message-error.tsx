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
      className="flex items-center gap-2 px-3 py-2 mt-1 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700"
    >
      <AlertCircle className="w-4 h-4 flex-shrink-0" />
      <span className="flex-1">{error}</span>
      {onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onRetry}
          className="h-7 px-2 text-red-600 hover:text-red-700 hover:bg-red-100"
          data-testid="retry-button"
        >
          <RotateCcw className="w-3.5 h-3.5 mr-1" />
          Retry
        </Button>
      )}
    </div>
  )
}
