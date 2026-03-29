interface AssumptionBannerProps {
  text: string
  onCorrect?: () => void
}

export function AssumptionBanner({ text, onCorrect }: AssumptionBannerProps) {
  return (
    <div data-testid="assumption-banner" className="flex items-center gap-2 px-3 py-1.5 mt-1 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700">
      <span className="flex-1">I assumed {text}</span>
      {onCorrect && (
        <button
          type="button"
          onClick={onCorrect}
          className="text-blue-600 hover:text-blue-800 underline"
          data-testid="correct-assumption"
        >
          Correct this
        </button>
      )}
    </div>
  )
}
