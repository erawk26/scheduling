/**
 * INT-002: Offline Queue Integration Test
 *
 * Tests the full offline→online cycle:
 * - Offline state simulation
 * - Enqueue multiple messages while offline
 * - Verify pending status
 * - Simulate network reconnection
 * - Verify auto-send triggers
 * - Verify successful messages get dequeued
 * - Verify failed sends leave messages pending with incremented attempts
 * - Verify 72hr stale detection with fake timers
 *
 * Uses jsdom environment for navigator.onLine and window.dispatchEvent.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { OfflineQueue, QueuedMessage, STALE_THRESHOLD_MS } from '../offline-queue'

describe('INT-002: Offline Queue Integration', () => {
  let queue: OfflineQueue
  let mockSend: (message: QueuedMessage) => Promise<void>
  let originalOnLine: boolean

  beforeEach(() => {
    // Save original online state
    originalOnLine = navigator.onLine

    // Reset to online by default for clean state
    Object.defineProperty(navigator, 'onLine', {
      value: true,
      writable: true,
      configurable: true,
    })

    mockSend = vi.fn().mockResolvedValue(undefined)
    queue = new OfflineQueue(mockSend)
  })

  afterEach(() => {
    vi.useRealTimers()
    queue.destroy()
    // Restore original online state
    Object.defineProperty(navigator, 'onLine', {
      value: originalOnLine,
      writable: true,
      configurable: true,
    })
  })

  describe('Full offline→online cycle', () => {
    it('enqueues multiple messages while offline, auto-sends on reconnect, and dequeues', async () => {
      // Step 1: Go offline
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })
      expect(navigator.onLine).toBe(false)

      // Step 2: Enqueue multiple messages while offline
      const msg1 = queue.enqueue('Message 1 content')
      const msg2 = queue.enqueue('Message 2 content')
      const msg3 = queue.enqueue('Message 3 content')

      // Step 3: Verify messages have pending status
      const queueAfterEnqueue = queue.getQueue()
      expect(queueAfterEnqueue).toHaveLength(3)
      expect(queueAfterEnqueue[0]!.status).toBe('pending')
      expect(queueAfterEnqueue[1]!.status).toBe('pending')
      expect(queueAfterEnqueue[2]!.status).toBe('pending')

      // Verify send was NOT called while offline
      expect(mockSend).not.toHaveBeenCalled()

      // Step 4: Simulate network reconnection
      window.dispatchEvent(new Event('online'))

      // Wait for the async processQueue to complete
      await Promise.resolve() // let event handler kick off
      await Promise.resolve() // let first send complete
      await Promise.resolve() // ensure all sends done

      // Step 5: Verify send was called for all 3 messages
      expect(mockSend).toHaveBeenCalledTimes(3)

      // Step 6: Verify messages are marked as sent
      const queueAfterSend = queue.getQueue()
      expect(queueAfterSend).toHaveLength(3)
      expect(queueAfterSend[0]!.status).toBe('sent')
      expect(queueAfterSend[1]!.status).toBe('sent')
      expect(queueAfterSend[2]!.status).toBe('sent')

      // Step 7: Verify dequeue removes sent messages
      queue.dequeue()
      const queueAfterDequeue = queue.getQueue()
      expect(queueAfterDequeue).toHaveLength(0)
    })

    it('handles send failures: leaves messages pending with incremented attempts', async () => {
      // Go offline first (optional, but we want to test failure handling)
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })

      // Mock send to fail once, then succeed
      const error = new Error('Network error')
      mockSend.mockRejectedValueOnce(error)
      // Second call will resolve (default mockResolvedValue)

      const msg1 = queue.enqueue('Failing message')
      const msg2 = queue.enqueue('Will succeed')

      // Reconnect to trigger processQueue
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
      window.dispatchEvent(new Event('online'))

      // Wait for processing
      await Promise.resolve()
      await Promise.resolve()

      // First message should still be pending (failed), attempts = 1
      const queueAfter = queue.getQueue()
      expect(queueAfter).toHaveLength(2)

      const failedMsg = queueAfter.find(m => m.id === msg1.id)!
      expect(failedMsg.status).toBe('pending')
      expect(failedMsg.attempts).toBe(1)

      // Second message should be sent
      const succeededMsg = queueAfter.find(m => m.id === msg2.id)!
      expect(succeededMsg.status).toBe('sent')
      expect(succeededMsg.attempts).toBe(1)

      // Total send calls: both messages attempted (2)
      expect(mockSend).toHaveBeenCalledTimes(2)

      // Clean up: remove the sent message
      queue.dequeue()
      expect(queue.getQueue()).toHaveLength(1)
    })

    it('retries pending messages on subsequent reconnects', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })
      mockSend.mockRejectedValue(new Error('Network down'))

      const msg1 = queue.enqueue('Retry me')

      // First reconnect attempt
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
      await Promise.resolve()

      // Should have attempted send once, still pending
      let queueState = queue.getQueue()
      expect(queueState[0]!.status).toBe('pending')
      expect(queueState[0]!.attempts).toBe(1)

      // Go offline and back online to trigger another retry
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })
      await Promise.resolve()
      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
      window.dispatchEvent(new Event('online'))
      await Promise.resolve()
      await Promise.resolve()

      queueState = queue.getQueue()
      expect(queueState[0]!.status).toBe('pending')
      expect(queueState[0]!.attempts).toBe(2)
      expect(mockSend).toHaveBeenCalledTimes(2)
    })

    it('does not automatically process queue when already online', async () => {
      // Already online (default), enqueue message
      const msg = queue.enqueue('Online enqueue')

      // processQueue is NOT automatically called on enqueue
      // Wait a tick to ensure no async auto-process
      await Promise.resolve()

      expect(mockSend).not.toHaveBeenCalled()
      expect(queue.getQueue()[0]!.status).toBe('pending')
    })

    it('processes only pending messages, skips stale and sent', async () => {
      const start = new Date('2026-01-01T00:00:00.000Z').getTime()
      vi.useFakeTimers()
      vi.setSystemTime(start)

      // Enqueue a stale message (old timestamp)
      const staleMsg = queue.enqueue('Stale')
      // Advance time past threshold
      vi.setSystemTime(start + STALE_THRESHOLD_MS + 1)
      // Enqueue a fresh message
      const normalMsg = queue.enqueue('Normal')
      // Enqueue a message and mark as sent
      const sentMsg = queue.enqueue('Already sent')
      sentMsg.status = 'sent'

      // Process the queue (still at advanced time)
      await queue.processQueue()

      // Only the fresh (normal) message should have been sent
      expect(mockSend).toHaveBeenCalledTimes(1)
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ content: 'Normal' }))

      const finalQueue = queue.getQueue()
      // Normal should be sent
      expect(finalQueue.find(m => m.id === normalMsg.id)!.status).toBe('sent')
      // Sent should remain sent
      expect(finalQueue.find(m => m.id === sentMsg.id)!.status).toBe('sent')
      // Stale should be stale
      expect(finalQueue.find(m => m.id === staleMsg.id)!.status).toBe('stale')
    })
  })

  describe('Stale detection (72 hours)', () => {
    it('marks messages stale after 72 hours', () => {
      const start = new Date('2026-01-01T00:00:00.000Z').getTime()
      vi.useFakeTimers()
      vi.setSystemTime(start)

      const msg = queue.enqueue('Old message')
      expect(msg.status).toBe('pending')

      // Advance past 72 hours
      vi.setSystemTime(start + STALE_THRESHOLD_MS + 1)

      // getQueue should re-evaluate status
      const queueAfter = queue.getQueue()
      expect(queueAfter[0]!.status).toBe('stale')
    })

    it('keeps messages pending within 72 hour window', () => {
      const start = new Date('2026-01-01T00:00:00.000Z').getTime()
      vi.useFakeTimers()
      vi.setSystemTime(start)

      const msg = queue.enqueue('Fresh message')

      // Advance to just under 72 hours
      vi.setSystemTime(start + STALE_THRESHOLD_MS - 1000)

      const queueAfter = queue.getQueue()
      expect(queueAfter[0]!.status).toBe('pending')
    })

    it('processQueue skips stale messages and does not attempt send', async () => {
      const start = new Date('2026-01-01T00:00:00.000Z').getTime()
      vi.useFakeTimers()
      vi.setSystemTime(start)

      queue.enqueue('Stale message')
      vi.setSystemTime(start + STALE_THRESHOLD_MS + 1)

      await queue.processQueue()

      expect(mockSend).not.toHaveBeenCalled()

      const queueAfter = queue.getQueue()
      expect(queueAfter[0]!.status).toBe('stale')
    })
  })

  describe('OfflineQueue lifecycle', () => {
    it('removes event listener on destroy', () => {
      const removeEventListenerSpy = vi.spyOn(window, 'removeEventListener')

      const newQueue = new OfflineQueue(mockSend)
      expect(removeEventListenerSpy).not.toHaveBeenCalled()

      newQueue.destroy()
      expect(removeEventListenerSpy).toHaveBeenCalledWith('online', expect.any(Function))
    })

    it('handles multiple enqueues before reconnection', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })

      const messages = Array.from({ length: 10 }, (_, i) => queue.enqueue(`Message ${i}`))

      expect(queue.getQueue()).toHaveLength(10)
      expect(mockSend).not.toHaveBeenCalled()

      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
      window.dispatchEvent(new Event('online'))

      // Wait for all sends to complete using vi.waitFor with an assertion
      await vi.waitFor(() => expect(mockSend).toHaveBeenCalledTimes(10), { timeout: 5000 })

      const queueAfter = queue.getQueue()
      expect(queueAfter).toHaveLength(10)
      expect(queueAfter.every(m => m.status === 'sent')).toBe(true)

      // Dequeue and verify empty
      queue.dequeue()
      expect(queue.getQueue()).toHaveLength(0)
    })

    it('maintains message order during processing', async () => {
      Object.defineProperty(navigator, 'onLine', { value: false, writable: true, configurable: true })

      const msg1 = queue.enqueue('First')
      const msg2 = queue.enqueue('Second')
      const msg3 = queue.enqueue('Third')

      // Track call order
      const callOrder: string[] = []
      mockSend.mockImplementation(async (msg) => {
        if (msg.id === msg1.id) callOrder.push('first')
        if (msg.id === msg2.id) callOrder.push('second')
        if (msg.id === msg3.id) callOrder.push('third')
      })

      Object.defineProperty(navigator, 'onLine', { value: true, writable: true, configurable: true })
      window.dispatchEvent(new Event('online'))

      await Promise.resolve()
      await Promise.resolve()

      expect(callOrder).toEqual(['first', 'second', 'third'])
    })
  })
})
