import { Button } from '@/components/ui/button'
import { Sparkles } from 'lucide-react'

interface OnboardingPromptsProps {
  onSelect: (prompt: string) => void
}

const EXAMPLE_PROMPTS = [
  "What's my schedule tomorrow?",
  "Show me this week's appointments",
  "Who are my clients?",
  "Help me plan next week",
  "Move my morning appointments",
  "Any weather alerts this week?",
]

export function OnboardingPrompts({ onSelect }: OnboardingPromptsProps) {
  return (
    <div data-testid="onboarding-prompts" className="space-y-3">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Sparkles className="w-4 h-4" />
        <span>Try asking me:</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.map((prompt) => (
          <Button
            key={prompt}
            variant="outline"
            size="sm"
            onClick={() => onSelect(prompt)}
            className="rounded-full text-xs h-8 px-3 border-border text-muted-foreground hover:text-primary hover:border-primary/30"
            data-testid="onboarding-prompt"
          >
            {prompt}
          </Button>
        ))}
      </div>
    </div>
  )
}
