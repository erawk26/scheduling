import { createFileRoute } from '@tanstack/react-router'
import VerifyEmailPage from '@/app/(auth)/verify-email/page'

export const Route = createFileRoute('/_auth/verify-email')({
  component: VerifyEmailPage,
})
