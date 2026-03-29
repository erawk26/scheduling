import { createFileRoute } from '@tanstack/react-router'
import BookPage from '@/app/book/[token]/page'

export const Route = createFileRoute('/book/$token/')({
  component: BookPage,
})
