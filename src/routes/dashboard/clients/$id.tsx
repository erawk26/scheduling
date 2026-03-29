import { createFileRoute } from '@tanstack/react-router'
import ClientDetailPage from '@/app/dashboard/clients/[id]/page'

export const Route = createFileRoute('/dashboard/clients/$id')({
  component: ClientDetailPage,
})
