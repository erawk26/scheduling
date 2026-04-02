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
  book: { label: 'New Booking', color: 'bg-success-muted text-success-muted-foreground' },
  reschedule: { label: 'Reschedule', color: 'bg-info-muted text-info-muted-foreground' },
  cancel: { label: 'Cancel', color: 'bg-destructive/10 text-destructive' },
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
      className="border border-border rounded-xl bg-card shadow-sm overflow-hidden max-w-sm"
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-secondary border-b border-border">
        <Calendar className="w-4 h-4 text-muted-foreground" />
        <span className="text-xs font-medium text-muted-foreground">Schedule Action</span>
        <span
          data-testid="action-badge"
          className={cn('ml-auto text-xs font-medium px-2 py-0.5 rounded-full', config.color)}
        >
          {config.label}
        </span>
      </div>

      <div className="px-4 py-3 space-y-2">
        <div className="flex items-center gap-2">
          <User className="w-4 h-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">{clientName}</span>
        </div>
        <div className="text-sm text-muted-foreground">{serviceName}</div>
        <div data-testid="preview-datetime" className="flex items-center gap-2 text-sm text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          <span>{formattedDate} at {formattedTime}</span>
        </div>
      </div>

      <div className="flex gap-2 px-4 py-3 bg-secondary border-t border-border">
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
