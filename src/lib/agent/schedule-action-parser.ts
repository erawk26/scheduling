/**
 * Parses schedule change proposals embedded in AI assistant responses.
 *
 * The AI is instructed to wrap schedule proposals in:
 *   <schedule-action>{"action":"reschedule","clientName":...}</schedule-action>
 *
 * This utility extracts that block, parses the JSON, and returns both the
 * structured action data and the cleaned message text (block removed).
 */

export type SchedulePreviewAction = 'book' | 'reschedule' | 'cancel' | 'swap'

export interface SwapPartner {
  clientName: string
  serviceName: string
  beforeDatetime: string
  afterDatetime: string
}

export interface ScheduleChangeData {
  action: SchedulePreviewAction
  clientName: string
  serviceName: string
  /** Proposed/final datetime (or current datetime for cancel) */
  datetime: string
  /** Original datetime — present for reschedule to show before/after diff */
  beforeDatetime?: string
  location?: string
  /** Only present for swap action */
  swapWith?: SwapPartner
}

const BLOCK_RE = /<schedule-action>([\s\S]*?)<\/schedule-action>/

export function parseScheduleAction(text: string): {
  scheduleAction: ScheduleChangeData | null
  cleanText: string
} {
  const match = BLOCK_RE.exec(text)
  if (!match) return { scheduleAction: null, cleanText: text }

  const cleanText = text.replace(match[0], '').trim()

  try {
    const parsed = JSON.parse(match[1]!.trim()) as Record<string, unknown>
    const action = parsed.action as SchedulePreviewAction
    if (!['book', 'reschedule', 'cancel', 'swap'].includes(action)) {
      return { scheduleAction: null, cleanText: text }
    }

    const scheduleAction: ScheduleChangeData = {
      action,
      clientName: String(parsed.clientName ?? ''),
      serviceName: String(parsed.serviceName ?? ''),
      datetime: String(parsed.datetime ?? ''),
      beforeDatetime: parsed.beforeDatetime ? String(parsed.beforeDatetime) : undefined,
      location: parsed.location ? String(parsed.location) : undefined,
    }

    if (action === 'swap' && parsed.swapWith && typeof parsed.swapWith === 'object') {
      const sw = parsed.swapWith as Record<string, unknown>
      scheduleAction.swapWith = {
        clientName: String(sw.clientName ?? ''),
        serviceName: String(sw.serviceName ?? ''),
        beforeDatetime: String(sw.beforeDatetime ?? ''),
        afterDatetime: String(sw.afterDatetime ?? ''),
      }
    }

    return { scheduleAction, cleanText }
  } catch {
    return { scheduleAction: null, cleanText: text }
  }
}
