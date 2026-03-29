import { Clock, AlertTriangle } from 'lucide-react'

interface PendingMessageProps {
  content: string
  isStale: boolean
  timestamp: string
}

export function PendingMessage({ content, isStale }: PendingMessageProps) {
  return (
    <div data-testid="pending-message" className="flex items-end gap-2 flex-row-reverse">
      <div className="flex items-center justify-center w-7 h-7 rounded-full bg-gray-200 flex-shrink-0">
        <Clock className="w-4 h-4 text-gray-400" />
      </div>
      <div className="flex flex-col gap-1 max-w-[75%] items-end">
        <div className="px-4 py-2.5 rounded-2xl rounded-br-sm bg-gray-200 text-gray-600 text-sm leading-relaxed whitespace-pre-wrap opacity-70">
          {content}
        </div>
        <div className="flex items-center gap-1 text-xs text-gray-400">
          {isStale ? (
            <>
              <AlertTriangle className="w-3 h-3 text-amber-500" />
              <span className="text-amber-600">Message stale — queued over 72 hours</span>
            </>
          ) : (
            <span>Will send when online</span>
          )}
        </div>
      </div>
    </div>
  )
}
