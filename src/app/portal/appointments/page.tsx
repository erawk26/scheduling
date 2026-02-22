'use client'

import { useState, useEffect } from 'react'
import { portalAuthClient } from '@/lib/portal-auth-client'
import { format, parseISO, isPast } from 'date-fns'

interface PortalAppointment {
  id: string
  start_time: string
  end_time: string
  status: string
  location_type: string
  address: string | null
  notes: string | null
  service: {
    name: string
    duration_minutes: number
  }
  pet: {
    name: string
    species: string
    breed: string | null
  } | null
}

export default function PortalAppointments() {
  const [appointments, setAppointments] = useState<PortalAppointment[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadAppointments() {
      try {
        const { data: session } = await portalAuthClient.getSession()
        if (!session) {
          window.location.href = '/portal/sign-in'
          return
        }

        const email = session.user.email
        const res = await fetch(`/api/portal/appointments?email=${encodeURIComponent(email)}`)
        if (!res.ok) throw new Error('Failed to fetch appointments')
        const { appointments: data } = await res.json()
        setAppointments(data || [])
      } catch {
        setError('Failed to load appointments')
      } finally {
        setIsLoading(false)
      }
    }

    loadAppointments()
  }, [])

  function handleStatusUpdate(id: string, newStatus: string) {
    setAppointments((prev) =>
      prev.map((a) => (a.id === id ? { ...a, status: newStatus } : a))
    )
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Your Appointments</h1>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 animate-pulse">
              <div className="h-4 bg-gray-200 rounded w-1/3 mb-3" />
              <div className="h-3 bg-gray-200 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-200 rounded w-1/4" />
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{error}</p>
        <button
          onClick={() => window.location.reload()}
          className="text-sm text-blue-600 hover:text-blue-700"
        >
          Try again
        </button>
      </div>
    )
  }

  if (appointments.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-2xl font-bold text-gray-900">Your Appointments</h1>
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <div className="h-12 w-12 rounded-full bg-gray-100 flex items-center justify-center mx-auto mb-4">
            <svg className="h-6 w-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h2 className="text-lg font-medium text-gray-900 mb-1">No appointments yet</h2>
          <p className="text-gray-500 text-sm">
            Your upcoming appointments will appear here once your service provider creates them.
          </p>
        </div>
      </div>
    )
  }

  const upcoming = appointments.filter((a) => !isPast(parseISO(a.end_time)) && a.status !== 'cancelled')
  const past = appointments.filter((a) => isPast(parseISO(a.end_time)) || a.status === 'cancelled')

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-900">Your Appointments</h1>

      {upcoming.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Upcoming</h2>
          {upcoming.map((apt) => (
            <AppointmentCard key={apt.id} appointment={apt} onStatusUpdate={handleStatusUpdate} />
          ))}
        </div>
      )}

      {past.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Past</h2>
          {past.map((apt) => (
            <AppointmentCard key={apt.id} appointment={apt} isPast onStatusUpdate={handleStatusUpdate} />
          ))}
        </div>
      )}
    </div>
  )
}

function AppointmentCard({
  appointment,
  isPast: isPastAppointment = false,
  onStatusUpdate,
}: {
  appointment: PortalAppointment
  isPast?: boolean
  onStatusUpdate?: (id: string, status: string) => void
}) {
  const [isUpdating, setIsUpdating] = useState(false)

  const statusColors: Record<string, string> = {
    scheduled: 'bg-blue-100 text-blue-700',
    confirmed: 'bg-green-100 text-green-700',
    in_progress: 'bg-yellow-100 text-yellow-700',
    completed: 'bg-gray-100 text-gray-700',
    cancelled: 'bg-red-100 text-red-700',
    no_show: 'bg-red-100 text-red-700',
  }

  async function handleStatusUpdate(newStatus: string) {
    setIsUpdating(true)
    try {
      const res = await fetch(`/api/portal/appointments/${appointment.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) throw new Error('Failed to update')
      onStatusUpdate?.(appointment.id, newStatus)
    } catch (err) {
      console.error('Failed to update appointment status:', err)
    } finally {
      setIsUpdating(false)
    }
  }

  const canConfirm = appointment.status === 'scheduled' && !isPastAppointment
  const canCancel = ['scheduled', 'confirmed'].includes(appointment.status) && !isPastAppointment

  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${isPastAppointment ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-medium text-gray-900">{appointment.service.name}</h3>
          {appointment.pet && (
            <p className="text-sm text-gray-500">
              {appointment.pet.name} ({appointment.pet.species}{appointment.pet.breed ? `, ${appointment.pet.breed}` : ''})
            </p>
          )}
        </div>
        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[appointment.status] || 'bg-gray-100 text-gray-700'}`}>
          {appointment.status.replace('_', ' ')}
        </span>
      </div>

      <div className="space-y-1 text-sm text-gray-600">
        <p>
          {format(parseISO(appointment.start_time), 'EEEE, MMMM d, yyyy')} at{' '}
          {format(parseISO(appointment.start_time), 'h:mm a')} -{' '}
          {format(parseISO(appointment.end_time), 'h:mm a')}
        </p>
        {appointment.address && (
          <p>{appointment.address}</p>
        )}
        {appointment.notes && (
          <p className="mt-2 text-gray-500 italic">{appointment.notes}</p>
        )}
      </div>

      {(canConfirm || canCancel) && (
        <div className="mt-4 flex gap-2">
          {canConfirm && (
            <button
              onClick={() => handleStatusUpdate('confirmed')}
              disabled={isUpdating}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 hover:bg-green-700 rounded-lg disabled:opacity-50 min-h-[44px]"
            >
              {isUpdating ? 'Confirming...' : 'Confirm'}
            </button>
          )}
          {canCancel && (
            <button
              onClick={() => handleStatusUpdate('cancelled')}
              disabled={isUpdating}
              className="px-4 py-2 text-sm font-medium text-red-700 bg-red-50 hover:bg-red-100 rounded-lg disabled:opacity-50 min-h-[44px]"
            >
              {isUpdating ? 'Cancelling...' : 'Cancel Appointment'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
