import { useState, useCallback } from 'react'
import { Search, X } from 'lucide-react'
import { Input } from '@/components/ui/input'

interface SearchResult {
  threadId: string
  threadTitle: string
  messageContent: string
  matchedTerms: string[]
  timestamp: string
}

interface ConversationSearchProps {
  onSearch: (query: string) => SearchResult[]
  onSelectResult: (threadId: string) => void
}

export function ConversationSearch({ onSearch, onSelectResult }: ConversationSearchProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [isOpen, setIsOpen] = useState(false)

  const handleSearch = useCallback((value: string) => {
    setQuery(value)
    if (value.trim().length >= 2) {
      const found = onSearch(value)
      setResults(found)
      setIsOpen(true)
    } else {
      setResults([])
      setIsOpen(false)
    }
  }, [onSearch])

  const handleClear = () => {
    setQuery('')
    setResults([])
    setIsOpen(false)
  }

  const truncateContent = (text: string): string => {
    return text.length > 100 ? text.slice(0, 100) + '...' : text
  }

  return (
    <div data-testid="conversation-search" className="relative px-3 pb-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
        <Input
          placeholder="Search conversations..."
          value={query}
          onChange={(e) => handleSearch(e.target.value)}
          className="h-8 pl-8 pr-8 text-xs rounded-lg"
          data-testid="search-input"
        />
        {query && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2.5 top-1/2 -translate-y-1/2"
            data-testid="search-clear"
          >
            <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
          </button>
        )}
      </div>

      {isOpen && results.length > 0 && (
        <div
          data-testid="search-results"
          className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-64 overflow-y-auto"
        >
          {results.map((result, i) => (
            <button
              key={`${result.threadId}-${i}`}
              type="button"
              onClick={() => {
                onSelectResult(result.threadId)
                handleClear()
              }}
              className="w-full text-left px-3 py-2 hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
              data-testid="search-result-item"
            >
              <p className="text-xs font-medium text-gray-700 truncate">{result.threadTitle}</p>
              <p className="text-xs text-gray-500 truncate mt-0.5">
                {truncateContent(result.messageContent)}
              </p>
            </button>
          ))}
        </div>
      )}

      {isOpen && query.trim().length >= 2 && results.length === 0 && (
        <div
          data-testid="search-no-results"
          className="absolute left-3 right-3 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 px-3 py-4 text-center"
        >
          <p className="text-xs text-gray-400">No results found</p>
        </div>
      )}
    </div>
  )
}

export type { SearchResult }
