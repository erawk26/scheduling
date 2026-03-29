import { createFileRoute } from '@tanstack/react-router'
import OfflinePage from '@/app/offline/page'

export const Route = createFileRoute('/offline')({
  component: OfflinePage,
})
