import { describe, it, expect } from 'vitest'
import { expandQuery } from '../synonyms'

describe('expandQuery', () => {
  it('expands "packed" to its synonyms', () => {
    const result = expandQuery('packed')
    expect(result).toContain('busy')
    expect(result).toContain('slammed')
    expect(result).toContain('overloaded')
    expect(result).toContain('booked')
    expect(result).toContain('full')
    expect(result).toContain('tight')
  })

  it('expands multiple words in a query', () => {
    const result = expandQuery('cancel my morning')
    expect(result).toContain('cancelled')
    expect(result).toContain('cancellation')
    expect(result).toContain('am')
    expect(result).toContain('early')
    expect(result).toContain('before noon')
    expect(result).toContain('my')
  })

  it('passes through unknown words unchanged', () => {
    const result = expandQuery('xyzzy foobar')
    expect(result).toContain('xyzzy')
    expect(result).toContain('foobar')
  })

  it('does not cause infinite loops with bidirectional synonyms', () => {
    // busy -> packed and packed -> busy should not recurse
    expect(() => expandQuery('busy packed')).not.toThrow()
    const result = expandQuery('busy packed')
    expect(typeof result).toBe('string')
  })

  it('handles empty string', () => {
    expect(expandQuery('')).toBe('')
  })

  it('expands "free" to availability synonyms', () => {
    const result = expandQuery('free')
    expect(result).toContain('open')
    expect(result).toContain('available')
    expect(result).toContain('clear')
  })

  it('expands "reschedule" synonyms', () => {
    const result = expandQuery('reschedule')
    expect(result).toContain('move')
    expect(result).toContain('shift')
    expect(result).toContain('postpone')
  })

  it('expands "client" synonyms', () => {
    const result = expandQuery('client')
    expect(result).toContain('customer')
    expect(result).toContain('owner')
  })

  it('expands "appointment" synonyms', () => {
    const result = expandQuery('appointment')
    expect(result).toContain('booking')
    expect(result).toContain('session')
    expect(result).toContain('slot')
  })
})
