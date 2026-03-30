/**
 * In-memory test double for @erawk26/localkit
 *
 * Provides stateful CRUD for all 9 collections with OfflineKit-compatible
 * metadata fields (_id, _collection, _updatedAt, _deleted).
 */

import { randomUUID } from 'crypto'
import type {
  Client,
  Pet,
  Service,
  Appointment,
  BusinessProfile,
  AgentNote,
  AgentProfile,
  AgentMemory,
  AgentConversation,
} from '@/lib/offlinekit/schema'

// OfflineKit metadata added to every document
interface OfflineKitMeta {
  _id: string
  _collection: string
  _updatedAt: string
  _deleted: boolean
}

type WithMeta<T> = T & OfflineKitMeta

function createCollection<T extends Record<string, unknown>>(name: string) {
  let docs: WithMeta<T>[] = []

  function matchesFilter(doc: WithMeta<T>, filter?: Partial<T>): boolean {
    if (!filter) return true
    return Object.entries(filter).every(
      ([key, value]) => doc[key] === value
    )
  }

  return {
    /** Return all non-deleted documents matching optional equality filter */
    findMany(filter?: Partial<T>): Promise<WithMeta<T>[]> {
      const result = docs.filter(
        (d) => !d._deleted && matchesFilter(d, filter)
      )
      return Promise.resolve(result)
    },

    /** Insert a new document, returns full document with metadata */
    create(data: Partial<T> & Record<string, unknown>): Promise<WithMeta<T>> {
      const now = new Date().toISOString()
      const id = (data.id as string) ?? randomUUID()
      const doc = {
        ...data,
        id,
        _id: id,
        _collection: name,
        _updatedAt: now,
        _deleted: false,
      } as unknown as WithMeta<T>
      docs.push(doc)
      return Promise.resolve(doc)
    },

    /** Update a non-deleted document by id, returns updated doc or null */
    update(id: string, data: Partial<T>): Promise<WithMeta<T> | null> {
      const idx = docs.findIndex(
        (d) => (d as Record<string, unknown>).id === id && !d._deleted
      )
      if (idx === -1) return Promise.resolve(null)
      const now = new Date().toISOString()
      docs[idx] = { ...docs[idx], ...data, _updatedAt: now } as WithMeta<T>
      return Promise.resolve(docs[idx])
    },

    /** Soft-delete a document by id */
    delete(id: string): Promise<boolean> {
      const idx = docs.findIndex(
        (d) => (d as Record<string, unknown>).id === id && !d._deleted
      )
      if (idx === -1) return Promise.resolve(false)
      const now = new Date().toISOString()
      docs[idx] = { ...docs[idx], _deleted: true, _updatedAt: now } as WithMeta<T>
      return Promise.resolve(true)
    },

    /** Direct access for assertions — includes deleted docs */
    _raw(): WithMeta<T>[] {
      return docs
    },

    /** Clear this collection */
    _reset(): void {
      docs = []
    },
  }
}

// All 9 collections
export const clients = createCollection<Client>('clients')
export const pets = createCollection<Pet>('pets')
export const services = createCollection<Service>('services')
export const appointments = createCollection<Appointment>('appointments')
export const businessProfile = createCollection<BusinessProfile>('businessProfile')
export const agentNotes = createCollection<AgentNote>('agentNotes')
export const agentProfile = createCollection<AgentProfile>('agentProfile')
export const agentMemories = createCollection<AgentMemory>('agentMemories')
export const agentConversations = createCollection<AgentConversation>('agentConversations')

/** Alias matching offlinekit's `app` export — tests import this */
export const app = {
  clients,
  pets,
  services,
  appointments,
  businessProfile,
  agentNotes,
  agentProfile,
  agentMemories,
  agentConversations,
}

/** Clear every collection — call in beforeEach for test isolation */
export function resetAll(): void {
  clients._reset()
  pets._reset()
  services._reset()
  appointments._reset()
  businessProfile._reset()
  agentNotes._reset()
  agentProfile._reset()
  agentMemories._reset()
  agentConversations._reset()
}
