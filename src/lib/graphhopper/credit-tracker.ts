/**
 * Tracks daily GraphHopper API credit usage (server-side only).
 * Resets at midnight UTC. Hard stop at 95%, warning at 80%.
 */

import { DEFAULT_RATE_CONFIG } from '@/lib/graphhopper/types';
import type { CreditUsage } from '@/lib/graphhopper/types';

class CreditTracker {
  private currentDate = '';
  private creditsUsed = 0;
  private config = DEFAULT_RATE_CONFIG;

  private ensureCurrentDate(): void {
    const today = new Date().toISOString().slice(0, 10);
    if (today !== this.currentDate) {
      this.currentDate = today;
      this.creditsUsed = 0;
    }
  }

  recordUsage(credits: number): void {
    this.ensureCurrentDate();
    this.creditsUsed += credits;
  }

  getUsage(): CreditUsage {
    this.ensureCurrentDate();
    return {
      date: this.currentDate,
      used: this.creditsUsed,
      limit: this.config.maxCreditsPerDay,
    };
  }

  canSpend(credits: number): boolean {
    this.ensureCurrentDate();
    const hardStop = this.config.maxCreditsPerDay * (this.config.hardStopAtPercent / 100);
    return this.creditsUsed + credits <= hardStop;
  }

  isWarning(): boolean {
    this.ensureCurrentDate();
    const warnThreshold = this.config.maxCreditsPerDay * (this.config.warnAtPercent / 100);
    return this.creditsUsed >= warnThreshold;
  }
}

export const creditTracker = new CreditTracker();
