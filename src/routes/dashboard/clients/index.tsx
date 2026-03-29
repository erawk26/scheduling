import { createFileRoute } from '@tanstack/react-router'
import ClientsPage from '@/app/dashboard/clients/page'

export const Route = createFileRoute('/dashboard/clients/')({
  component: ClientsPage,
})
