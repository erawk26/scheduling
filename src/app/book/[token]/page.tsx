/**
 * Public Booking Page
 *
 * Server component — no auth required.
 * Verifies JWT from URL param and renders time slot picker.
 */

import type { Metadata } from 'next';
import { verifyBookingToken } from '@/lib/email/jwt';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import BookingSlotPicker from './slot-picker';

export const metadata: Metadata = {
  title: 'Book Your Appointment',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function BookingPage({ params }: PageProps) {
  const { token } = await params;
  const result = await verifyBookingToken(token);

  if (!result) {
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
    );
  }

  if (result.expired) {
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
    );
  }

  const { payload } = result;

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
  );
}
