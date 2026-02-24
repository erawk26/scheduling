/**
 * In-memory LRU cache with TTL for GraphHopper API responses (server-side only).
 * Geocode results: permanent (no TTL). Route results: 1 hour TTL.
 */

interface CacheEntry<T> {
  value: T;
  expiresAt: number; // 0 = never expires
  lastAccess: number;
}

export class ApiCache {
  private store = new Map<string, CacheEntry<unknown>>();
  private maxEntries: number;

  constructor(maxEntries = 1000) {
    this.maxEntries = maxEntries;
  }

  get<T>(key: string): T | null {
    const entry = this.store.get(key) as CacheEntry<T> | undefined;
    if (!entry) return null;

    if (entry.expiresAt !== 0 && Date.now() > entry.expiresAt) {
      this.store.delete(key);
      return null;
    }

    entry.lastAccess = Date.now();
    return entry.value;
  }

  set<T>(key: string, value: T, ttlMs = 0): void {
    if (this.store.size >= this.maxEntries) {
      this.evictLRU();
    }

    this.store.set(key, {
      value,
      expiresAt: ttlMs > 0 ? Date.now() + ttlMs : 0,
      lastAccess: Date.now(),
    });
  }

  has(key: string): boolean {
    return this.get(key) !== null;
  }

  clear(): void {
    this.store.clear();
  }

  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestAccess = Infinity;

    for (const [key, entry] of this.store) {
      if (entry.lastAccess < oldestAccess) {
        oldestAccess = entry.lastAccess;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.store.delete(oldestKey);
    }
  }
}
