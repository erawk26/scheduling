import { Button } from '@/components/ui/button'

interface DisambiguationChipsProps {
  options: string[]
  onSelect: (option: string) => void
  maxOptions?: number
}

export function DisambiguationChips({ options, onSelect, maxOptions = 3 }: DisambiguationChipsProps) {
  const visibleOptions = options.slice(0, maxOptions)

  return (
    <div data-testid="disambiguation-chips" className="flex flex-wrap gap-2 mt-2">
      {visibleOptions.map((option) => (
        <Button
          key={option}
          variant="outline"
          size="sm"
          onClick={() => onSelect(option)}
          className="rounded-full text-xs h-8 px-3 border-primary/30 text-primary hover:bg-primary/10"
          data-testid="disambiguation-chip"
        >
          {option}
        </Button>
      ))}
    </div>
  )
}
