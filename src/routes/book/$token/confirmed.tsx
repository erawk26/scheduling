import { createFileRoute } from '@tanstack/react-router'
import ConfirmedPage from '@/app/book/[token]/confirmed/page'

export const Route = createFileRoute('/book/$token/confirmed')({
  component: ConfirmedPage,
})
