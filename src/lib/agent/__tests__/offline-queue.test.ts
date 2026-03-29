import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import type { QueuedMessage } from '../offline-queue'
import { OfflineQueue, STALE_THRESHOLD_MS } from '../offline-queue'

describe('OfflineQueue', () => {
  let queue: OfflineQueue
  let mockSend: (message: QueuedMessage) => Promise<void>

  beforeEach(() => {
    mockSend = vi.fn().mockResolvedValue(undefined)
    queue = new OfflineQueue(mockSend)
  })

  afterEach(() => {
    vi.useRealTimers()
    queue.destroy()
  })

  it('enqueue adds a message to the queue', () => {
    queue.enqueue('Hello world')
    expect(queue.getQueue()).toHaveLength(1)
  })

  it('getQueue returns all queued messages', () => {
    queue.enqueue('first')
    queue.enqueue('second')
    const q = queue.getQueue()
    expect(q).toHaveLength(2)
    expect(q[0]!.content).toBe('first')
    expect(q[1]!.content).toBe('second')
  })

  it('messages start with pending status', () => {
    queue.enqueue('Hello')
    const [msg] = queue.getQueue()
    expect(msg!.status).toBe('pending')
  })

  it('enqueue assigns a unique id and timestamp', () => {
    queue.enqueue('msg1')
    queue.enqueue('msg2')
    const [a, b] = queue.getQueue()
    expect(a!.id).toBeTruthy()
    expect(b!.id).toBeTruthy()
    expect(a!.id).not.toBe(b!.id)
    expect(typeof a!.timestamp).toBe('string')
  })

  it('messages are marked stale after 72 hours', () => {
    const start = new Date('2026-01-01T00:00:00.000Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(start)
    queue.enqueue('old message')
    vi.setSystemTime(start + STALE_THRESHOLD_MS + 1)
    const [msg] = queue.getQueue()
    expect(msg!.status).toBe('stale')
  })

  it('messages within 72 hours remain pending', () => {
    const start = new Date('2026-01-01T00:00:00.000Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(start)
    queue.enqueue('fresh message')
    vi.setSystemTime(start + STALE_THRESHOLD_MS - 1000)
    const [msg] = queue.getQueue()
    expect(msg!.status).toBe('pending')
  })

  it('processQueue calls send for each pending message', async () => {
    queue.enqueue('msg1')
    queue.enqueue('msg2')
    await queue.processQueue()
    expect(vi.mocked(mockSend)).toHaveBeenCalledTimes(2)
  })

  it('processQueue marks sent messages as sent', async () => {
    queue.enqueue('hello')
    await queue.processQueue()
    const [msg] = queue.getQueue()
    expect(msg!.status).toBe('sent')
  })

  it('processQueue does not call send for stale messages', async () => {
    const start = new Date('2026-01-01T00:00:00.000Z').getTime()
    vi.useFakeTimers()
    vi.setSystemTime(start)
    queue.enqueue('stale msg')
    vi.setSystemTime(start + STALE_THRESHOLD_MS + 1)
    await queue.processQueue()
    expect(vi.mocked(mockSend)).not.toHaveBeenCalled()
  })

  it('processQueue increments attempts on each call', async () => {
    vi.mocked(mockSend).mockRejectedValueOnce(new Error('network error'))
    queue.enqueue('msg')
    await queue.processQueue()
    const [msg] = queue.getQueue()
    expect(msg!.attempts).toBe(1)
  })

  it('dequeue removes messages with sent status', async () => {
    queue.enqueue('msg1')
    queue.enqueue('msg2')
    await queue.processQueue()
    queue.dequeue()
    const remaining = queue.getQueue()
    expect(remaining.every(m => m.status !== 'sent')).toBe(true)
  })
})
