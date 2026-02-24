/**
 * Token-bucket rate limiter for GraphHopper API (server-side only).
 * Default: 1 request per second (free tier limit).
 */
export class RateLimiter {
  private queue: Array<() => void> = [];
  private lastRequestTime = 0;
  private minIntervalMs: number;
  private processing = false;

  constructor(maxPerSecond = 1) {
    this.minIntervalMs = 1000 / maxPerSecond;
  }

  async acquire(): Promise<void> {
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
      if (!this.processing) {
        void this.processQueue();
      }
    });
  }

  private async processQueue(): Promise<void> {
    this.processing = true;

    while (this.queue.length > 0) {
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      const waitMs = Math.max(0, this.minIntervalMs - elapsed);

      if (waitMs > 0) {
        await new Promise<void>((r) => setTimeout(r, waitMs));
      }

      this.lastRequestTime = Date.now();
      const next = this.queue.shift();
      if (next) next();
    }

    this.processing = false;
  }
}
