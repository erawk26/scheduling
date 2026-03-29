import { Bot } from 'lucide-react'
import { OnboardingPrompts } from './onboarding-prompts'

interface OnboardingIntroProps {
  isNewUser: boolean
  onSelectPrompt: (prompt: string) => void
}

export function OnboardingIntro({ isNewUser, onSelectPrompt }: OnboardingIntroProps) {
  if (!isNewUser) return null

  return (
    <div data-testid="onboarding-intro" className="flex flex-col items-center gap-4 py-8 px-4 text-center">
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-primary/10">
        <Bot className="w-7 h-7 text-primary" />
      </div>
      <div className="space-y-2 max-w-md">
        <h2 className="text-lg font-semibold text-gray-900">
          Hi! I&apos;m your scheduling assistant
        </h2>
        <p className="text-sm text-gray-500">
          Let me get to know you better so I can help manage your appointments,
          clients, and schedule. I&apos;ll ask a few quick questions to get started.
        </p>
      </div>
      <OnboardingPrompts onSelect={onSelectPrompt} />
    </div>
  )
}
