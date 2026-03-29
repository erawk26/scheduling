import MiniSearch from 'minisearch'
import { expandQuery } from './synonyms'
import type { CollectionName, SearchDocument, SearchResult } from './types'

const COLLECTION_BOOST: Record<CollectionName, number> = {
  agentProfile: 1.5,
  agentNotes: 1.2,
  clients: 1.3,
  pets: 1.0,
  services: 1.0,
  appointments: 1.0,
}

const DEFAULT_LIMIT = 20

export class AgentSearchIndex {
  private index: MiniSearch<SearchDocument>
  private docs: Map<string, SearchDocument>

  constructor() {
    this.index = new MiniSearch<SearchDocument>({
      fields: ['text'],
      storeFields: ['id', 'collection', 'text', 'boost'],
      searchOptions: {
        boost: { text: 1 },
        fuzzy: 0.2,
        prefix: true,
      },
    })
    this.docs = new Map()
  }

  addDocuments(_collection: CollectionName, documents: SearchDocument[]): void {
    const toAdd = documents.filter(d => !this.docs.has(d.id))
    for (const doc of toAdd) {
      this.docs.set(doc.id, doc)
    }
    if (toAdd.length > 0) {
      this.index.addAll(toAdd)
    }
  }

  removeDocument(id: string): void {
    const doc = this.docs.get(id)
    if (doc) {
      this.index.remove(doc)
      this.docs.delete(id)
    }
  }

  search(query: string, options?: { limit?: number; collections?: CollectionName[] }): SearchResult[] {
    const expanded = expandQuery(query)
    const limit = options?.limit ?? DEFAULT_LIMIT
    const collections = options?.collections

    const raw = this.index.search(expanded)

    const results: SearchResult[] = []
    for (const hit of raw) {
      const doc = this.docs.get(hit.id)
      if (!doc) continue
      if (collections && !collections.includes(doc.collection)) continue

      const collectionBoost = COLLECTION_BOOST[doc.collection]
      const docBoost = doc.boost ?? 1.0
      const score = hit.score * collectionBoost * docBoost

      results.push({ id: doc.id, collection: doc.collection, score, document: doc })
    }

    results.sort((a, b) => b.score - a.score)
    return results.slice(0, limit)
  }

  get documentCount(): number {
    return this.docs.size
  }

  exportIndex(): string {
    return JSON.stringify(this.index.toJSON())
  }

  importIndex(data: string): void {
    this.index = MiniSearch.loadJSON<SearchDocument>(data, {
      fields: ['text'],
      storeFields: ['id', 'collection', 'text', 'boost'],
      searchOptions: {
        boost: { text: 1 },
        fuzzy: 0.2,
        prefix: true,
      },
    })
    this.docs.clear()
    const parsed = JSON.parse(data) as { storedFields?: Record<string, SearchDocument> }
    if (parsed.storedFields) {
      for (const doc of Object.values(parsed.storedFields)) {
        this.docs.set(doc.id, doc)
      }
    }
  }

  clear(): void {
    this.index.removeAll()
    this.docs.clear()
  }
}
