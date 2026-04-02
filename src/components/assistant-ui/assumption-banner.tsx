interface AssumptionBannerProps {
  text: string
  onCorrect?: () => void
}

export function AssumptionBanner({ text, onCorrect }: AssumptionBannerProps) {
  return (
    <div data-testid="assumption-banner" className="flex items-center gap-2 px-3 py-1.5 mt-1 rounded-lg bg-info-muted border border-info-muted-foreground/20 text-xs text-info-muted-foreground">
      <span className="flex-1">I assumed {text}</span>
      {onCorrect && (
        <button
          type="button"
          onClick={onCorrect}
          className="text-primary hover:text-primary/80 underline"
          data-testid="correct-assumption"
        >
          Correct this
        </button>
      )}
    </div>
  )
}
