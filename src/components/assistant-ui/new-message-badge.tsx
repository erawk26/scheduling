import { ChevronDown } from 'lucide-react'

interface NewMessageBadgeProps {
  visible: boolean
  onClick: () => void
  count?: number
}

export function NewMessageBadge({ visible, onClick, count }: NewMessageBadgeProps) {
  if (!visible) return null

  return (
    <button
      type="button"
      onClick={onClick}
      className="absolute bottom-20 left-1/2 -translate-x-1/2 z-10 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary text-white text-xs font-medium shadow-lg hover:bg-primary/90 transition-colors"
      data-testid="new-message-badge"
    >
      <ChevronDown className="w-3.5 h-3.5" />
      {count && count > 0 ? `${count} new message${count > 1 ? 's' : ''}` : 'New messages'}
    </button>
  )
}
