import { createFileRoute } from '@tanstack/react-router'
import RoutesPage from '@/app/dashboard/routes/page'

export const Route = createFileRoute('/dashboard/routes')({
  component: RoutesPage,
})
