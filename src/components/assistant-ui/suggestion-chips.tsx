import { Button } from '@/components/ui/button'
import { Calendar, Clock, Users, MessageSquare } from 'lucide-react'
import type { ReactNode } from 'react'

interface Suggestion {
  label: string
  query: string
  icon?: ReactNode
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { label: "What's on tomorrow?", query: "What appointments do I have tomorrow?", icon: <Calendar className="w-3.5 h-3.5" /> },
  { label: "This week's schedule", query: "Show me this week's schedule", icon: <Clock className="w-3.5 h-3.5" /> },
  { label: "My clients", query: "List my clients", icon: <Users className="w-3.5 h-3.5" /> },
  { label: "Add appointment", query: "Help me schedule a new appointment", icon: <MessageSquare className="w-3.5 h-3.5" /> },
]

interface SuggestionChipsProps {
  suggestions?: Suggestion[]
  onSelect: (query: string) => void
  maxChips?: number
  visible?: boolean
}

export function SuggestionChips({
  suggestions = DEFAULT_SUGGESTIONS,
  onSelect,
  maxChips = 4,
  visible = true,
}: SuggestionChipsProps) {
  if (!visible) return null

  const visibleSuggestions = suggestions.slice(0, maxChips)

  return (
    <div data-testid="suggestion-chips" className="flex flex-wrap gap-2 justify-center px-4 py-2">
      {visibleSuggestions.map((suggestion) => (
        <Button
          key={suggestion.label}
          variant="outline"
          size="sm"
          onClick={() => onSelect(suggestion.query)}
          className="rounded-full text-xs h-8 gap-1.5 border-gray-200 text-gray-600 hover:text-gray-900 hover:border-gray-300"
          data-testid="suggestion-chip"
        >
          {suggestion.icon}
          {suggestion.label}
        </Button>
      ))}
    </div>
  )
}

export type { Suggestion }
