import { createFileRoute } from '@tanstack/react-router'
import SettingsPage from '@/app/dashboard/settings/page'

export const Route = createFileRoute('/dashboard/settings/')({
  component: SettingsPage,
})
