import { createFileRoute } from '@tanstack/react-router'
import ProfilePage from '@/app/dashboard/settings/profile/page'

export const Route = createFileRoute('/dashboard/settings/profile')({
  component: ProfilePage,
})
