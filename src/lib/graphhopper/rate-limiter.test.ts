import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { RateLimiter } from './rate-limiter';

describe('RateLimiter', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('resolves immediately on first call', async () => {
    const limiter = new RateLimiter(1);
    const start = Date.now();
    await limiter.acquire();
    expect(Date.now() - start).toBeLessThan(50);
  });

  it('queues concurrent requests with minimum interval', async () => {
    const limiter = new RateLimiter(1); // 1 req/sec = 1000ms interval
    const resolved: number[] = [];

    // Fire 3 concurrent acquires
    const p1 = limiter.acquire().then(() => resolved.push(1));
    const p2 = limiter.acquire().then(() => resolved.push(2));
    const p3 = limiter.acquire().then(() => resolved.push(3));

    // First resolves immediately
    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toContain(1);

    // Second resolves after ~1000ms
    await vi.advanceTimersByTimeAsync(1000);
    expect(resolved).toContain(2);

    // Third resolves after ~2000ms total
    await vi.advanceTimersByTimeAsync(1000);
    await Promise.all([p1, p2, p3]);
    expect(resolved).toEqual([1, 2, 3]);
  });

  it('respects custom maxPerSecond rate', async () => {
    const limiter = new RateLimiter(2); // 2 req/sec = 500ms interval
    const resolved: number[] = [];

    const p1 = limiter.acquire().then(() => resolved.push(1));
    const p2 = limiter.acquire().then(() => resolved.push(2));

    await vi.advanceTimersByTimeAsync(0);
    expect(resolved).toContain(1);

    await vi.advanceTimersByTimeAsync(500);
    await Promise.all([p1, p2]);
    expect(resolved).toEqual([1, 2]);
  });
});
