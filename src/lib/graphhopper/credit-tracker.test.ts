import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// We need a fresh CreditTracker per test, so import the class constructor
// The module exports a singleton, so we re-import each time
describe('CreditTracker', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-02-23T12:00:00Z') });
    vi.resetModules();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function getTracker() {
    const mod = await import('./credit-tracker');
    return mod.creditTracker;
  }

  it('starts with zero usage', async () => {
    const tracker = await getTracker();
    const usage = tracker.getUsage();
    expect(usage.used).toBe(0);
    expect(usage.limit).toBe(500);
    expect(usage.date).toBe('2026-02-23');
  });

  it('records credit usage', async () => {
    const tracker = await getTracker();
    tracker.recordUsage(10);
    tracker.recordUsage(5.5);
    expect(tracker.getUsage().used).toBe(15.5);
  });

  it('canSpend returns true when under limit', async () => {
    const tracker = await getTracker();
    expect(tracker.canSpend(100)).toBe(true);
  });

  it('canSpend returns false when at hard stop (95%)', async () => {
    const tracker = await getTracker();
    // 500 * 0.95 = 475 hard stop
    tracker.recordUsage(470);
    expect(tracker.canSpend(10)).toBe(false); // 470 + 10 = 480 > 475
    expect(tracker.canSpend(5)).toBe(true);   // 470 + 5 = 475 <= 475
  });

  it('isWarning returns true at 80% threshold', async () => {
    const tracker = await getTracker();
    expect(tracker.isWarning()).toBe(false);

    // 500 * 0.80 = 400 warning threshold
    tracker.recordUsage(400);
    expect(tracker.isWarning()).toBe(true);
  });

  it('resets daily at midnight UTC', async () => {
    const tracker = await getTracker();
    tracker.recordUsage(200);
    expect(tracker.getUsage().used).toBe(200);

    // Advance to next day
    vi.setSystemTime(new Date('2026-02-24T00:00:01Z'));
    expect(tracker.getUsage().used).toBe(0);
    expect(tracker.getUsage().date).toBe('2026-02-24');
  });
});
