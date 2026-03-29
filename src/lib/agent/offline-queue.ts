/**
 * Offline message queue — stores pending messages locally and auto-sends
 * when the network is restored.
 */

export const STALE_THRESHOLD_MS = 72 * 60 * 60 * 1000 // 72 hours

export type QueuedMessageStatus = 'pending' | 'sent' | 'stale'

export type QueuedMessage = {
  id: string
  content: string
  timestamp: string
  status: QueuedMessageStatus
  attempts: number
}

type SendFn = (message: QueuedMessage) => Promise<void>

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`
}

function resolveStatus(msg: QueuedMessage): QueuedMessage {
  if (msg.status === 'sent') return msg
  const age = Date.now() - new Date(msg.timestamp).getTime()
  if (age > STALE_THRESHOLD_MS) return { ...msg, status: 'stale' }
  return msg
}

export class OfflineQueue {
  private queue: QueuedMessage[] = []
  private readonly sendFn: SendFn
  private onlineHandler: (() => void) | null = null

  constructor(sendFn: SendFn) {
    this.sendFn = sendFn
    if (typeof window !== 'undefined') {
      this.onlineHandler = () => { void this.processQueue() }
      window.addEventListener('online', this.onlineHandler)
    }
  }

  enqueue(content: string): QueuedMessage {
    const msg: QueuedMessage = {
      id: generateId(),
      content,
      timestamp: new Date().toISOString(),
      status: 'pending',
      attempts: 0,
    }
    this.queue.push(msg)
    return msg
  }

  getQueue(): QueuedMessage[] {
    this.queue = this.queue.map(resolveStatus)
    return [...this.queue]
  }

  async processQueue(): Promise<void> {
    this.queue = this.queue.map(resolveStatus)

    for (let i = 0; i < this.queue.length; i++) {
      const msg = this.queue[i]
      if (!msg || msg.status !== 'pending') continue

      try {
        await this.sendFn(msg)
        this.queue[i] = { id: msg.id, content: msg.content, timestamp: msg.timestamp, status: 'sent', attempts: msg.attempts + 1 }
      } catch {
        this.queue[i] = { id: msg.id, content: msg.content, timestamp: msg.timestamp, status: msg.status, attempts: msg.attempts + 1 }
      }
    }
  }

  dequeue(): void {
    this.queue = this.queue.filter(m => m.status !== 'sent')
  }

  destroy(): void {
    if (typeof window !== 'undefined' && this.onlineHandler) {
      window.removeEventListener('online', this.onlineHandler)
    }
  }
}
