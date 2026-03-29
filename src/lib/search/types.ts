export type CollectionName = 'agentProfile' | 'agentNotes' | 'clients' | 'pets' | 'services' | 'appointments'

export interface SearchDocument {
  id: string
  collection: CollectionName
  text: string
  boost?: number
}

export interface SearchResult {
  id: string
  collection: CollectionName
  score: number
  document: SearchDocument
}
