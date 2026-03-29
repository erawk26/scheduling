import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { OnboardingPrompts } from '../onboarding-prompts'

describe('OnboardingPrompts', () => {
  it('renders 6 example prompts', () => {
    render(<OnboardingPrompts onSelect={vi.fn()} />)
    expect(screen.getByTestId('onboarding-prompts')).toBeInTheDocument()
    const prompts = screen.getAllByTestId('onboarding-prompt')
    expect(prompts).toHaveLength(6)
  })

  it('calls onSelect with prompt text when clicked', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<OnboardingPrompts onSelect={onSelect} />)
    const prompts = screen.getAllByTestId('onboarding-prompt')
    await user.click(prompts[0])
    expect(onSelect).toHaveBeenCalledWith("What's my schedule tomorrow?")
  })

  it('calls onSelect with correct text for second prompt', async () => {
    const user = userEvent.setup()
    const onSelect = vi.fn()
    render(<OnboardingPrompts onSelect={onSelect} />)
    const prompts = screen.getAllByTestId('onboarding-prompt')
    await user.click(prompts[1])
    expect(onSelect).toHaveBeenCalledWith("Show me this week's appointments")
  })

  it('has data-testid="onboarding-prompts" on container', () => {
    render(<OnboardingPrompts onSelect={vi.fn()} />)
    expect(screen.getByTestId('onboarding-prompts')).toBeInTheDocument()
  })

  it('has data-testid="onboarding-prompt" on each button', () => {
    render(<OnboardingPrompts onSelect={vi.fn()} />)
    const prompts = screen.getAllByTestId('onboarding-prompt')
    expect(prompts.length).toBeGreaterThan(0)
    prompts.forEach((p) => expect(p.tagName).toBe('BUTTON'))
  })
})
