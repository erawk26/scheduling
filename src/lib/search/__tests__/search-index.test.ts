import { describe, it, expect, beforeEach } from 'vitest'
import { AgentSearchIndex } from '../search-index'
import type { SearchDocument } from '../types'

function makeDoc(id: string, collection: SearchDocument['collection'], text: string, boost?: number): SearchDocument {
  return { id, collection, text, ...(boost !== undefined ? { boost } : {}) }
}

describe('AgentSearchIndex', () => {
  let index: AgentSearchIndex

  beforeEach(() => {
    index = new AgentSearchIndex()
  })

  describe('addDocuments', () => {
    it('indexes documents from all 6 collections', () => {
      const collections: SearchDocument['collection'][] = [
        'agentProfile', 'agentNotes', 'clients', 'pets', 'services', 'appointments',
      ]
      collections.forEach((collection, i) => {
        index.addDocuments(collection, [makeDoc(`doc-${i}`, collection, `sample text for ${collection}`)])
      })
      expect(index.documentCount).toBe(6)
    })

    it('increments documentCount correctly', () => {
      index.addDocuments('clients', [
        makeDoc('c1', 'clients', 'Alice Johnson'),
        makeDoc('c2', 'clients', 'Bob Smith'),
      ])
      expect(index.documentCount).toBe(2)
    })
  })

  describe('search', () => {
    beforeEach(() => {
      index.addDocuments('clients', [
        makeDoc('client-oak', 'clients', 'Jane Doe lives at Oak Street'),
        makeDoc('client-elm', 'clients', 'Tom Harris lives at Elm Avenue'),
      ])
      index.addDocuments('appointments', [
        makeDoc('appt-tue', 'appointments', 'Tuesday appointment busy schedule full day'),
        makeDoc('appt-wed', 'appointments', 'Wednesday morning grooming session'),
      ])
      index.addDocuments('services', [
        makeDoc('svc-1', 'services', 'Full grooming bath and cut styling'),
      ])
    })

    it('returns results for synonym-expanded query: packed -> busy', () => {
      const results = index.search('my Tuesdays are packed')
      expect(results.length).toBeGreaterThan(0)
      const ids = results.map(r => r.id)
      expect(ids).toContain('appt-tue')
    })

    it('returns results for "the client on Oak Street"', () => {
      const results = index.search('the client on Oak Street')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.id).toBe('client-oak')
    })

    it('returns empty array for irrelevant query', () => {
      const results = index.search('hello')
      expect(results).toEqual([])
    })

    it('fuzzy matches "Johnsn" to "Johnson"', () => {
      index.addDocuments('clients', [makeDoc('c-johnson', 'clients', 'Mrs Johnson at Maple Lane')])
      const results = index.search('Johnsn')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.id).toBe('c-johnson')
    })

    it('respects default limit of 20', () => {
      const docs = Array.from({ length: 30 }, (_, i) =>
        makeDoc(`bulk-${i}`, 'agentNotes', `note about grooming client appointment booking session`)
      )
      index.addDocuments('agentNotes', docs)
      const results = index.search('grooming')
      expect(results.length).toBeLessThanOrEqual(20)
    })

    it('respects custom limit option', () => {
      const docs = Array.from({ length: 15 }, (_, i) =>
        makeDoc(`svc-bulk-${i}`, 'services', `grooming service bath cut`)
      )
      index.addDocuments('services', docs)
      const results = index.search('grooming', { limit: 5 })
      expect(results.length).toBeLessThanOrEqual(5)
    })

    it('filters by collection', () => {
      const results = index.search('appointment', { collections: ['clients'] })
      results.forEach(r => expect(r.collection).toBe('clients'))
    })

    it('returns results only from specified collections', () => {
      index.addDocuments('agentNotes', [makeDoc('note-1', 'agentNotes', 'grooming appointment booking')])
      const results = index.search('grooming', { collections: ['services'] })
      results.forEach(r => expect(r.collection).toBe('services'))
    })

    it('results are sorted by score descending', () => {
      const results = index.search('grooming')
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1]!.score).toBeGreaterThanOrEqual(results[i]!.score)
      }
    })

    it('each result has id, collection, score, and document', () => {
      const results = index.search('Oak Street')
      expect(results.length).toBeGreaterThan(0)
      const r = results[0]!
      expect(r).toHaveProperty('id')
      expect(r).toHaveProperty('collection')
      expect(r).toHaveProperty('score')
      expect(r).toHaveProperty('document')
      expect(r.document).toHaveProperty('text')
    })
  })

  describe('removeDocument', () => {
    it('removes a document by ID', () => {
      index.addDocuments('clients', [makeDoc('to-remove', 'clients', 'unique client grooming')])
      const before = index.documentCount
      index.removeDocument('to-remove')
      expect(index.documentCount).toBe(before - 1)
    })

    it('removed document does not appear in search results', () => {
      index.addDocuments('clients', [makeDoc('del-me', 'clients', 'deletable unique term zqxwvp')])
      index.removeDocument('del-me')
      const results = index.search('zqxwvp')
      expect(results.map(r => r.id)).not.toContain('del-me')
    })
  })

  describe('exportIndex / importIndex', () => {
    it('exportIndex returns a JSON string', () => {
      index.addDocuments('clients', [makeDoc('e1', 'clients', 'export test client')])
      const exported = index.exportIndex()
      expect(typeof exported).toBe('string')
      expect(() => JSON.parse(exported)).not.toThrow()
    })

    it('importIndex restores the index and search still works', () => {
      index.addDocuments('clients', [makeDoc('i1', 'clients', 'import test grooming')])
      const exported = index.exportIndex()

      const newIndex = new AgentSearchIndex()
      newIndex.importIndex(exported)
      const results = newIndex.search('grooming')
      expect(results.length).toBeGreaterThan(0)
      expect(results[0]!.id).toBe('i1')
    })
  })

  describe('clear', () => {
    it('resets document count to 0', () => {
      index.addDocuments('clients', [makeDoc('cl1', 'clients', 'some client text')])
      index.clear()
      expect(index.documentCount).toBe(0)
    })

    it('returns empty results after clear', () => {
      index.addDocuments('clients', [makeDoc('cl2', 'clients', 'unique grooming client')])
      index.clear()
      expect(index.search('grooming')).toEqual([])
    })
  })

  describe('performance', () => {
    it('search latency is <10ms for 2000 documents', () => {
      const docs: SearchDocument[] = Array.from({ length: 2000 }, (_, i) => ({
        id: `perf-${i}`,
        collection: 'appointments' as const,
        text: `appointment for client number ${i} grooming service booking session`,
      }))
      index.addDocuments('appointments', docs)
      expect(index.documentCount).toBe(2000)

      const start = performance.now()
      index.search('grooming client appointment')
      const elapsed = performance.now() - start

      expect(elapsed).toBeLessThan(10)
    })
  })
})
