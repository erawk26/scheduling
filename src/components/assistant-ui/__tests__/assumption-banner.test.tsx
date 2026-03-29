import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { AssumptionBanner } from '../assumption-banner'

describe('AssumptionBanner', () => {
  it('renders "I assumed {text}"', () => {
    render(<AssumptionBanner text="this is Tuesday's appointment" />)
    expect(screen.getByTestId('assumption-banner')).toBeInTheDocument()
    expect(screen.getByTestId('assumption-banner')).toHaveTextContent("I assumed this is Tuesday's appointment")
  })

  it('shows "Correct this" when onCorrect is provided', () => {
    render(<AssumptionBanner text="morning slot" onCorrect={vi.fn()} />)
    expect(screen.getByTestId('correct-assumption')).toBeInTheDocument()
    expect(screen.getByTestId('correct-assumption')).toHaveTextContent('Correct this')
  })

  it('hides "Correct this" when onCorrect is not provided', () => {
    render(<AssumptionBanner text="morning slot" />)
    expect(screen.queryByTestId('correct-assumption')).not.toBeInTheDocument()
  })

  it('calls onCorrect when "Correct this" is clicked', async () => {
    const user = userEvent.setup()
    const onCorrect = vi.fn()
    render(<AssumptionBanner text="morning slot" onCorrect={onCorrect} />)
    await user.click(screen.getByTestId('correct-assumption'))
    expect(onCorrect).toHaveBeenCalledTimes(1)
  })
})
