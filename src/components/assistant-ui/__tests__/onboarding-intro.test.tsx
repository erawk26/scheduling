import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingIntro } from '../onboarding-intro'

describe('OnboardingIntro', () => {
  it('renders when isNewUser is true', () => {
    render(<OnboardingIntro isNewUser={true} onSelectPrompt={vi.fn()} />)
    expect(screen.getByTestId('onboarding-intro')).toBeInTheDocument()
  })

  it('does not render when isNewUser is false', () => {
    render(<OnboardingIntro isNewUser={false} onSelectPrompt={vi.fn()} />)
    expect(screen.queryByTestId('onboarding-intro')).not.toBeInTheDocument()
  })

  it('shows greeting text', () => {
    render(<OnboardingIntro isNewUser={true} onSelectPrompt={vi.fn()} />)
    expect(screen.getByText("Hi! I'm your scheduling assistant")).toBeInTheDocument()
  })

  it('shows description text', () => {
    render(<OnboardingIntro isNewUser={true} onSelectPrompt={vi.fn()} />)
    expect(screen.getByText(/Let me get to know you better/)).toBeInTheDocument()
  })

  it('renders OnboardingPrompts', () => {
    render(<OnboardingIntro isNewUser={true} onSelectPrompt={vi.fn()} />)
    expect(screen.getByTestId('onboarding-prompts')).toBeInTheDocument()
  })

  it('passes onSelectPrompt to OnboardingPrompts', async () => {
    const user = userEvent.setup()
    const onSelectPrompt = vi.fn()
    render(<OnboardingIntro isNewUser={true} onSelectPrompt={onSelectPrompt} />)
    const prompts = screen.getAllByTestId('onboarding-prompt')
    await user.click(prompts[0])
    expect(onSelectPrompt).toHaveBeenCalled()
  })
})
