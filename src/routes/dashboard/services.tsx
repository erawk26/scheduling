import { createFileRoute } from '@tanstack/react-router'
import ServicesPage from '@/app/dashboard/services/page'

export const Route = createFileRoute('/dashboard/services')({
  component: ServicesPage,
})
