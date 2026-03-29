import { createFileRoute } from '@tanstack/react-router'
import ChatPage from '@/app/dashboard/chat/page'

export const Route = createFileRoute('/dashboard/chat')({
  component: ChatPage,
})
