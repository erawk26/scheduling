import { createFileRoute } from '@tanstack/react-router'
import AppointmentsPage from '@/app/dashboard/appointments/page'

export const Route = createFileRoute('/dashboard/appointments')({
  component: AppointmentsPage,
})
