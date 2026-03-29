import { createFileRoute } from '@tanstack/react-router'
import BillingPage from '@/app/dashboard/settings/billing/page'

export const Route = createFileRoute('/dashboard/settings/billing')({
  component: BillingPage,
})
