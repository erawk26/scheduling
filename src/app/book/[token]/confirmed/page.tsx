/**
 * Booking Confirmed Page
 *
 * Server component — shown after a client picks a time slot.
 * Verifies token to display appointment details.
 */

import type { Metadata } from 'next';
import { verifyBookingToken } from '@/lib/email/jwt';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Appointment Confirmed',
  robots: { index: false, follow: false },
};

interface PageProps {
  params: Promise<{ token: string }>;
}

function buildGoogleCalendarUrl(params: {
  title: string;
  details: string;
  startIso: string;
  durationMinutes?: number;
}): string {
  const start = new Date(params.startIso);
  const end = new Date(start.getTime() + (params.durationMinutes ?? 60) * 60 * 1000);

  function toGcal(d: Date) {
    return d.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  }

  const query = new URLSearchParams({
    action: 'TEMPLATE',
    text: params.title,
    details: params.details,
    dates: `${toGcal(start)}/${toGcal(end)}`,
  });

  return `https://calendar.google.com/calendar/render?${query.toString()}`;
}

export default async function ConfirmedPage({ params }: PageProps) {
  const { token } = await params;
  const result = await verifyBookingToken(token);

  // Read confirmation file to get selected slot
  let selectedSlot: string | null = null;

  if (result) {
    try {
      const { readFile } = await import('fs/promises');
      const path = await import('path');
      const filePath = path.join(
        process.cwd(),
        '.omc',
        'bookings',
        `${result.payload.appointmentId}.json`
      );
      const raw = await readFile(filePath, 'utf8');
      const booking = JSON.parse(raw);
      selectedSlot = booking.selectedSlot ?? null;
    } catch {
      // File not found or unreadable — proceed without slot detail
    }
  }

  if (!result) {
    return (
      <main className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Link</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This link is invalid. Please contact your service provider.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  const { payload } = result;
  const slotDate = selectedSlot ? new Date(selectedSlot) : null;

  const formattedDate = slotDate
    ? slotDate.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })
    : null;

  const formattedTime = slotDate
    ? slotDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
    : null;

  const calendarUrl = slotDate
    ? buildGoogleCalendarUrl({
        title: `${payload.serviceName} with ${payload.businessName}`,
        details: `Booked via KE Agenda`,
        startIso: slotDate.toISOString(),
      })
    : null;

  return (
    <main className="min-h-screen bg-muted/40 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader>
          <div className="flex items-center gap-3">
            <CheckCircle className="text-green-500 w-8 h-8 shrink-0" />
            <CardTitle className="text-xl">You&apos;re confirmed!</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-muted-foreground">
            <strong>{payload.serviceName}</strong>
            {formattedDate && formattedTime && (
              <>
                {' '}on <strong>{formattedDate}</strong> at <strong>{formattedTime}</strong>
              </>
            )}
          </p>

          <p className="text-sm text-muted-foreground">
            Booked with <strong>{payload.businessName}</strong>
          </p>

          {calendarUrl && (
            <a
              href={calendarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-11 px-4 w-full rounded-md border border-input bg-background text-sm font-medium hover:bg-accent hover:text-accent-foreground transition-colors"
            >
              Add to Google Calendar
            </a>
          )}

          <p className="text-xs text-muted-foreground text-center">
            Need to make changes? Contact {payload.businessName} directly.
          </p>
        </CardContent>
      </Card>
    </main>
  );
}
