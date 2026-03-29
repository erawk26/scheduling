import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { resolve } from 'path'

const ENGINE_PATH = resolve(__dirname, '../engine.ts')
const ENGINE_STREAM_PATH = resolve(__dirname, '../engine-stream.ts')

describe('Engine Wiring', () => {
  it('engine.ts does not use StructuredContextProvider', () => {
    const src = readFileSync(ENGINE_PATH, 'utf-8')
    expect(src).not.toContain('new StructuredContextProvider')
  })

  it('engine-stream.ts does not use StructuredContextProvider', () => {
    const src = readFileSync(ENGINE_STREAM_PATH, 'utf-8')
    expect(src).not.toContain('new StructuredContextProvider')
  })

  it('engine.ts uses TieredContextProvider', () => {
    const src = readFileSync(ENGINE_PATH, 'utf-8')
    expect(src).toContain('TieredContextProvider')
  })

  it('engine-stream.ts uses TieredContextProvider', () => {
    const src = readFileSync(ENGINE_STREAM_PATH, 'utf-8')
    expect(src).toContain('TieredContextProvider')
  })
})
