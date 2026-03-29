import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { SchedulePreviewCard } from '../schedule-preview-card'

describe('SchedulePreviewCard', () => {
  const defaultProps = {
    action: 'book' as const,
    clientName: 'Sarah Johnson',
    serviceName: 'Full Groom',
    datetime: '2026-01-15T09:00:00',
    onAccept: vi.fn(),
    onDecline: vi.fn(),
  }

  it('renders client name', () => {
    render(<SchedulePreviewCard {...defaultProps} />)
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument()
  })

  it('renders service name', () => {
    render(<SchedulePreviewCard {...defaultProps} />)
    expect(screen.getByText('Full Groom')).toBeInTheDocument()
  })

  it('renders formatted datetime', () => {
    render(<SchedulePreviewCard {...defaultProps} />)
    expect(screen.getByTestId('preview-datetime')).toBeInTheDocument()
  })

  it('shows action type badge for booking', () => {
    render(<SchedulePreviewCard {...defaultProps} action="book" />)
    expect(screen.getByTestId('action-badge')).toHaveTextContent(/book/i)
  })

  it('shows action type badge for reschedule', () => {
    render(<SchedulePreviewCard {...defaultProps} action="reschedule" />)
    expect(screen.getByTestId('action-badge')).toHaveTextContent(/reschedule/i)
  })

  it('shows action type badge for cancel', () => {
    render(<SchedulePreviewCard {...defaultProps} action="cancel" />)
    expect(screen.getByTestId('action-badge')).toHaveTextContent(/cancel/i)
  })

  it('renders accept button', () => {
    render(<SchedulePreviewCard {...defaultProps} />)
    expect(screen.getByTestId('accept-button')).toBeInTheDocument()
  })

  it('renders decline button', () => {
    render(<SchedulePreviewCard {...defaultProps} />)
    expect(screen.getByTestId('decline-button')).toBeInTheDocument()
  })

  it('calls onAccept when accept clicked', () => {
    render(<SchedulePreviewCard {...defaultProps} />)
    fireEvent.click(screen.getByTestId('accept-button'))
    expect(defaultProps.onAccept).toHaveBeenCalledOnce()
  })

  it('calls onDecline when decline clicked', () => {
    render(<SchedulePreviewCard {...defaultProps} />)
    fireEvent.click(screen.getByTestId('decline-button'))
    expect(defaultProps.onDecline).toHaveBeenCalledOnce()
  })

  it('has data-testid="schedule-preview-card"', () => {
    render(<SchedulePreviewCard {...defaultProps} />)
    expect(screen.getByTestId('schedule-preview-card')).toBeInTheDocument()
  })
})
