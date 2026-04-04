import { useState } from 'react'
import { format, parseISO } from 'date-fns'
import { Calendar, Clock, User, MapPin, Check, X, ArrowRight, ArrowLeftRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ScheduleAction = 'book' | 'reschedule' | 'cancel' | 'swap'

interface SwapPartner {
  clientName: string
  serviceName: string
  beforeDatetime: string
  afterDatetime: string
}

interface SchedulePreviewCardProps {
  action: ScheduleAction
  clientName: string
  serviceName: string
  /** Proposed/final datetime (or current datetime for cancel/book) */
  datetime: string
  /** Original datetime — renders a before/after diff when present on reschedule */
  beforeDatetime?: string
  location?: string
  swapWith?: SwapPartner
  onAccept: () => void
  onDecline: () => void
}

const ACTION_CONFIG: Record<ScheduleAction, { label: string; headerClass: string; badgeClass: string }> = {
  book: {
    label: 'New Booking',
    headerClass: 'bg-success-muted border-b border-border',
    badgeClass: 'bg-success-muted text-success-muted-foreground',
  },
  reschedule: {
    label: 'Reschedule',
    headerClass: 'bg-info-muted border-b border-border',
    badgeClass: 'bg-info-muted text-info-muted-foreground',
  },
  cancel: {
    label: 'Cancel',
    headerClass: 'bg-destructive/10 border-b border-destructive/20',
    badgeClass: 'bg-destructive/10 text-destructive',
  },
  swap: {
    label: 'Swap',
    headerClass: 'bg-warning-muted border-b border-border',
    badgeClass: 'bg-warning-muted text-warning-muted-foreground',
  },
}

function formatDatetime(iso: string): { date: string; time: string } {
  const d = parseISO(iso)
  return {
    date: format(d, 'EEE, MMM d'),
    time: format(d, 'h:mm a'),
  }
}

export function SchedulePreviewCard({
  action,
  clientName,
  serviceName,
  datetime,
  beforeDatetime,
  location,
  swapWith,
  onAccept,
  onDecline,
}: SchedulePreviewCardProps) {
  const [decided, setDecided] = useState<'accepted' | 'declined' | null>(null)
  const config = ACTION_CONFIG[action]
  const after = formatDatetime(datetime)
  const before = beforeDatetime ? formatDatetime(beforeDatetime) : null

  function handleAccept() {
    setDecided('accepted')
    onAccept()
  }

  function handleDecline() {
    setDecided('declined')
    onDecline()
  }

  return (
    <div
      data-testid="schedule-preview-card"
      className="border border-border rounded-xl bg-card shadow-sm overflow-hidden max-w-sm w-full"
    >
      {/* Header */}
      <div className={cn('flex items-center gap-2 px-4 py-2', config.headerClass)}>
        {action === 'swap' ? (
          <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
        ) : (
          <Calendar className="w-4 h-4 text-muted-foreground" />
        )}
        <span className="text-xs font-medium text-muted-foreground">Schedule Action</span>
        <span
          data-testid="action-badge"
          className={cn('ml-auto text-xs font-medium px-2 py-0.5 rounded-full', config.badgeClass)}
        >
          {config.label}
        </span>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-3">
        {action === 'swap' && swapWith ? (
          <SwapBody
            clientA={clientName}
            serviceA={serviceName}
            beforeA={beforeDatetime ? formatDatetime(beforeDatetime) : after}
            afterA={after}
            clientB={swapWith.clientName}
            serviceB={swapWith.serviceName}
            beforeB={formatDatetime(swapWith.beforeDatetime)}
            afterB={formatDatetime(swapWith.afterDatetime)}
          />
        ) : (
          <>
            {/* Client + service */}
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm font-medium text-foreground">{clientName}</span>
              </div>
              <div className="text-sm text-muted-foreground pl-6">{serviceName}</div>
            </div>

            {/* Datetime diff */}
            {action === 'reschedule' && before ? (
              <RescheduleDiff before={before} after={after} />
            ) : (
              <div
                data-testid="preview-datetime"
                className={cn(
                  'flex items-center gap-2 text-sm pl-6',
                  action === 'cancel'
                    ? 'text-destructive line-through decoration-destructive'
                    : 'text-muted-foreground'
                )}
              >
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{after.date} at {after.time}</span>
              </div>
            )}

            {/* Location */}
            {location && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground pl-6">
                <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{location}</span>
              </div>
            )}
          </>
        )}
      </div>

      {/* Footer with action buttons */}
      <div className="flex gap-2 px-4 py-3 bg-secondary border-t border-border">
        {decided === 'accepted' && (
          <div className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-success-muted-foreground">
            <Check className="w-4 h-4" />
            Confirmed
          </div>
        )}
        {decided === 'declined' && (
          <div className="flex-1 flex items-center justify-center gap-1.5 text-sm font-medium text-muted-foreground">
            <X className="w-4 h-4" />
            Declined
          </div>
        )}
        {!decided && (
          <>
            <Button
              data-testid="accept-button"
              size="sm"
              onClick={handleAccept}
              className="flex-1 gap-1"
            >
              <Check className="w-3.5 h-3.5" />
              Confirm
            </Button>
            <Button
              data-testid="decline-button"
              variant="outline"
              size="sm"
              onClick={handleDecline}
              className="flex-1 gap-1"
            >
              <X className="w-3.5 h-3.5" />
              Decline
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function RescheduleDiff({
  before,
  after,
}: {
  before: { date: string; time: string }
  after: { date: string; time: string }
}) {
  const dateChanged = before.date !== after.date
  const timeChanged = before.time !== after.time

  return (
    <div data-testid="preview-datetime" className="space-y-1.5 pl-6">
      {/* Before row */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground line-through decoration-muted-foreground/50">
        <Clock className="w-3.5 h-3.5 flex-shrink-0 no-underline" style={{ textDecoration: 'none' }} />
        <span>{before.date} at {before.time}</span>
      </div>

      {/* Arrow */}
      <div className="flex items-center gap-1.5 pl-0.5">
        <ArrowRight className="w-3.5 h-3.5 text-accent" />
      </div>

      {/* After row */}
      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <Clock className="w-3.5 h-3.5 flex-shrink-0" />
        <span>
          <span className={cn(dateChanged && 'underline decoration-primary/50')}>{after.date}</span>
          {' at '}
          <span className={cn(timeChanged && 'underline decoration-primary/50')}>{after.time}</span>
        </span>
      </div>
    </div>
  )
}

function SwapBody({
  clientA, serviceA, beforeA, afterA,
  clientB, serviceB, beforeB, afterB,
}: {
  clientA: string; serviceA: string; beforeA: { date: string; time: string }; afterA: { date: string; time: string }
  clientB: string; serviceB: string; beforeB: { date: string; time: string }; afterB: { date: string; time: string }
}) {
  return (
    <div className="space-y-3">
      <SwapRow client={clientA} service={serviceA} from={beforeA} to={afterA} />
      <div className="flex items-center gap-2">
        <div className="flex-1 h-px bg-border" />
        <ArrowLeftRight className="w-3.5 h-3.5 text-accent flex-shrink-0" />
        <div className="flex-1 h-px bg-border" />
      </div>
      <SwapRow client={clientB} service={serviceB} from={beforeB} to={afterB} />
    </div>
  )
}

function SwapRow({
  client, service, from, to,
}: {
  client: string
  service: string
  from: { date: string; time: string }
  to: { date: string; time: string }
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <User className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
        <span className="text-sm font-medium text-foreground">{client}</span>
        <span className="text-xs text-muted-foreground">— {service}</span>
      </div>
      <div className="pl-5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="line-through">{from.date} {from.time}</span>
        <ArrowRight className="w-3 h-3 text-accent flex-shrink-0" />
        <span className="text-primary font-medium">{to.date} {to.time}</span>
      </div>
    </div>
  )
}

export type { ScheduleAction, SchedulePreviewCardProps }
