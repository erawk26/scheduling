import { createFileRoute } from '@tanstack/react-router'
import { verifyBookingToken } from '@/lib/email/jwt'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import BookingSlotPicker from '@/app/book/[token]/slot-picker'

export const Route = createFileRoute('/book/$token/')({
  loader: async ({ params }) => {
    const result = await verifyBookingToken(params.token)
    if (!result) return { status: 'invalid' as const }
    if (result.expired) return { status: 'expired' as const, payload: result.payload }
    return { status: 'valid' as const, payload: result.payload }
  },
  component: BookPageRoute,
})

function BookPageRoute() {
  const data = Route.useLoaderData()
  const { token } = Route.useParams()

  if (data.status === 'invalid') {
    return (
      <main className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Booking Link</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This booking link is invalid. Please contact your service provider.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  if (data.status === 'expired') {
    return (
      <main className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle>Booking Link Expired</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This booking link has expired. Please contact your service provider to receive a new one.
            </p>
          </CardContent>
        </Card>
      </main>
    )
  }

  const { payload } = data

  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <p className="text-sm font-medium text-muted-foreground">{payload.businessName}</p>
          <CardTitle className="text-xl leading-snug">
            Hi {payload.clientName}!
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <p className="text-muted-foreground">
            <strong>{payload.businessName}</strong> would like to schedule your{' '}
            <strong>{payload.serviceName}</strong>. Please pick a time that works for you.
          </p>
          <BookingSlotPicker token={token} slots={payload.slots} />
        </CardContent>
      </Card>
    </main>
  )
}
