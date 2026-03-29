import { format, parseISO } from 'date-fns'
import { Calendar, Clock, User, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ScheduleAction = 'book' | 'reschedule' | 'cancel'

interface SchedulePreviewCardProps {
  action: ScheduleAction
  clientName: string
  serviceName: string
  datetime: string
  onAccept: () => void
  onDecline: () => void
}

const ACTION_CONFIG: Record<ScheduleAction, { label: string; color: string }> = {
  book: { label: 'New Booking', color: 'bg-green-100 text-green-700' },
  reschedule: { label: 'Reschedule', color: 'bg-blue-100 text-blue-700' },
  cancel: { label: 'Cancel', color: 'bg-red-100 text-red-700' },
}

export function SchedulePreviewCard({
  action,
  clientName,
  serviceName,
  datetime,
  onAccept,
  onDecline,
}: SchedulePreviewCardProps) {
  const config = ACTION_CONFIG[action]
  const date = parseISO(datetime)
  const formattedDate = format(date, 'EEE, MMM d')
  const formattedTime = format(date, 'h:mm a')

  return (
    <div
      data-testid="schedule-preview-card"
      className="border border-gray-200 rounded-xl bg-white shadow-sm overflow-hidden max-w-sm"
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-100">
        <Calendar className="w-4 h-4 text-gray-400" />
        <span className="text-xs font-medium text-gray-600">Schedule Action</span>
        <span
          data-testid="action-badge"
          className={cn('ml-auto text-xs font-medium px-2 py-0.5 rounded-full', config.color)}
        >
          {config.label}
        </span>
      </div>

      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-medium text-gray-900">{clientName}</span>
        </div>
        <div className="text-sm text-gray-600">{serviceName}</div>
        <div data-testid="preview-datetime" className="flex items-center gap-2 text-sm text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{formattedDate} at {formattedTime}</span>
        </div>
      </div>

      <div className="flex gap-2 px-4 py-3 bg-gray-50 border-t border-gray-100">
        <Button
          data-testid="accept-button"
          size="sm"
          onClick={onAccept}
          className="flex-1 gap-1"
        >
          <Check className="w-3.5 h-3.5" />
          Confirm
        </Button>
        <Button
          data-testid="decline-button"
          variant="outline"
          size="sm"
          onClick={onDecline}
          className="flex-1 gap-1"
        >
          <X className="w-3.5 h-3.5" />
          Decline
        </Button>
      </div>
    </div>
  )
}

export type { ScheduleAction, SchedulePreviewCardProps }
