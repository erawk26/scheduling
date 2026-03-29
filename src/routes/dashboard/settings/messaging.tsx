import { createFileRoute } from '@tanstack/react-router'
import MessagingPage from '@/app/dashboard/settings/messaging/page'

export const Route = createFileRoute('/dashboard/settings/messaging')({
  component: MessagingPage,
})
