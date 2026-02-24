import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ApiCache } from './cache';

describe('ApiCache', () => {
  beforeEach(() => {
    vi.useFakeTimers({ now: new Date('2026-02-23T12:00:00Z') });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('stores and retrieves values', () => {
    const cache = new ApiCache();
    cache.set('key1', { data: 'hello' });
    expect(cache.get('key1')).toEqual({ data: 'hello' });
  });

  it('returns null for missing keys', () => {
    const cache = new ApiCache();
    expect(cache.get('nonexistent')).toBeNull();
  });

  it('respects TTL expiration', () => {
    const cache = new ApiCache();
    cache.set('key1', 'value', 5000); // 5 second TTL

    expect(cache.get('key1')).toBe('value');

    vi.advanceTimersByTime(6000);
    expect(cache.get('key1')).toBeNull();
  });

  it('permanent entries never expire (ttlMs = 0)', () => {
    const cache = new ApiCache();
    cache.set('permanent', 'forever');

    vi.advanceTimersByTime(24 * 60 * 60 * 1000); // 1 day
    expect(cache.get('permanent')).toBe('forever');
  });

  it('evicts LRU entry when at max capacity', () => {
    const cache = new ApiCache(3);
    cache.set('a', 1);
    cache.set('b', 2);
    cache.set('c', 3);

    // Access 'a' to make it recently used
    vi.advanceTimersByTime(1);
    cache.get('a');

    // Adding a 4th entry should evict 'b' (least recently accessed)
    cache.set('d', 4);

    expect(cache.get('a')).toBe(1); // still exists (was accessed)
    expect(cache.get('b')).toBeNull(); // evicted
    expect(cache.get('c')).toBe(3);
    expect(cache.get('d')).toBe(4);
  });

  it('has() returns true for existing keys', () => {
    const cache = new ApiCache();
    cache.set('key', 'value');
    expect(cache.has('key')).toBe(true);
    expect(cache.has('missing')).toBe(false);
  });

  it('clear() removes all entries', () => {
    const cache = new ApiCache();
    cache.set('a', 1);
    cache.set('b', 2);
    cache.clear();
    expect(cache.get('a')).toBeNull();
    expect(cache.get('b')).toBeNull();
  });
});
