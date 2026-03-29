import { describe, it, expect } from 'vitest'
import { buildPrompt } from '@/lib/agent/prompt-builder'
import type { AgentContext } from '@/lib/agent/context/types'
import * as fs from 'node:fs'
import * as path from 'node:path'

describe('Type Unification', () => {
  // Test 1: buildPrompt accepts canonical AgentContext with full context
  it('buildPrompt accepts canonical AgentContext with schedule/clients/profile/notes', () => {
    const ctx: AgentContext = {
      query: 'What is my schedule tomorrow?',
      schedule: {
        dateRange: { from: '2026-01-01', to: '2026-01-02' },
        appointments: [{
          id: '1', start_time: '2026-01-01T09:00:00', end_time: '2026-01-01T10:00:00',
          status: 'confirmed', clientName: 'John', serviceName: 'Grooming',
          address: '123 Main St', notes: null, weather_alert: 0
        }]
      },
      clients: {
        clients: [{
          id: 'c1', first_name: 'John', last_name: 'Doe', email: null, phone: null,
          address: '123 Main St', scheduling_flexibility: 'flexible', notes: null, pets: []
        }]
      },
      profile: { sections: [{ section_id: 'business', content: { name: 'Pet Care Pro' } }] },
      notes: { notes: [{ id: 'n1', summary: 'Client prefers mornings', content: null, tags: [], date_ref: null, client_id: 'c1' }] }
    }
    const skill = { name: 'test', systemPrompt: 'You are helpful', piiLevel: 'full' as const }
    const messages = buildPrompt(skill, ctx, 'What is tomorrow?')
    expect(messages).toHaveLength(2)
    expect(messages[0]!.role).toBe('system')
    expect(messages[0]!.content).toContain('John')
    expect(messages[0]!.content).toContain('Grooming')
    expect(messages[1]!.role).toBe('user')
  })

  // Test 2: buildPrompt accepts minimal context (query only)
  it('buildPrompt accepts minimal AgentContext (query only)', () => {
    const ctx: AgentContext = { query: 'Hello' }
    const skill = { name: 'test', systemPrompt: 'You are helpful', piiLevel: 'full' as const }
    const messages = buildPrompt(skill, ctx, 'Hello')
    expect(messages).toHaveLength(2)
    expect(messages[0]!.content).toContain('You are helpful')
  })

  // Test 3: buildPrompt serializes profile sections
  it('buildPrompt serializes profile sections as readable text', () => {
    const ctx: AgentContext = {
      query: 'test',
      profile: { sections: [{ section_id: 'business', content: { name: 'Pet Care Pro', timezone: 'America/New_York' } }] }
    }
    const skill = { name: 'test', systemPrompt: 'System', piiLevel: 'full' as const }
    const messages = buildPrompt(skill, ctx, 'test')
    expect(messages[0]!.content).toContain('Pet Care Pro')
  })

  // Test 4: buildPrompt serializes notes
  it('buildPrompt serializes notes with summaries', () => {
    const ctx: AgentContext = {
      query: 'test',
      notes: { notes: [{ id: 'n1', summary: 'Prefers afternoons', content: 'Detailed note', tags: ['preference'], date_ref: '2026-01-01', client_id: null }] }
    }
    const skill = { name: 'test', systemPrompt: 'System', piiLevel: 'full' as const }
    const messages = buildPrompt(skill, ctx, 'test')
    expect(messages[0]!.content).toContain('Prefers afternoons')
  })

  // Test 5: No import of AgentContext from types.ts anywhere (except types.ts itself)
  it('should not import AgentContext from src/lib/agent/types.ts', () => {
    const agentDir = path.resolve(__dirname, '../..')

    function scanDir(dir: string): string[] {
      const violations: string[] = []
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)
        if (entry.isDirectory() && entry.name !== '__tests__' && entry.name !== 'node_modules') {
          violations.push(...scanDir(fullPath))
        } else if ((entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && entry.name !== 'types.ts') {
          const content = fs.readFileSync(fullPath, 'utf8')
          if (content.includes("AgentContext") && content.includes("from '@/lib/agent/types'") || content.includes('from "../types"') || content.includes("from '../types'")) {
            if (content.includes('AgentContext')) {
              violations.push(fullPath)
            }
          }
        }
      }
      return violations
    }

    const violations = scanDir(agentDir)
    expect(violations).toEqual([])
  })

  // Test 6: No toAgentContext bridge functions in skills
  it('should not have toAgentContext bridge functions in skills', () => {
    const skillsDir = path.resolve(__dirname, '../../skills')
    const entries = fs.readdirSync(skillsDir).filter(f => f.endsWith('.ts'))
    const violations: string[] = []
    for (const file of entries) {
      const content = fs.readFileSync(path.join(skillsDir, file), 'utf8')
      if (content.includes('toAgentContext') || content.includes('toPromptContext')) {
        violations.push(file)
      }
    }
    expect(violations).toEqual([])
  })
})
