'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';

interface Slot {
  label: string;
  value: string;
}

interface Props {
  token: string;
  slots: Slot[];
}

export default function BookingSlotPicker({ token, slots }: Props) {
  const router = useRouter();
  const [showDecline, setShowDecline] = useState(false);
  const [declineReason, setDeclineReason] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function confirmSlot(selectedSlot: string) {
    setLoading(selectedSlot);
    setError(null);

    try {
      const res = await fetch('/api/book/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, selectedSlot }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      router.push(data.redirectTo);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(null);
    }
  }

  async function submitDecline() {
    if (!declineReason.trim()) return;

    setLoading('decline');
    setError(null);

    try {
      const res = await fetch('/api/book/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, declineReason: declineReason.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }

      setShowDecline(false);
      setDeclineReason('');
      setError(null);
      // Show a thank-you inline
      setLoading('done');
    } catch {
      setError('Network error. Please try again.');
    } finally {
      if (loading !== 'done') setLoading(null);
    }
  }

  if (loading === 'done') {
    return (
      <p className="text-muted-foreground text-sm">
        Thanks for letting us know. Your service provider will reach out with new options.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-sm font-medium">Select a time slot:</p>

      <div className="flex flex-col gap-2">
        {slots.map((slot) => (
          <Button
            key={slot.value}
            onClick={() => confirmSlot(slot.value)}
            disabled={loading !== null}
            className="h-12 w-full text-base justify-start px-4"
            variant="outline"
          >
            {loading === slot.value ? 'Confirming…' : slot.label}
          </Button>
        ))}
      </div>

      {!showDecline && (
        <Button
          variant="ghost"
          className="w-full h-11 text-muted-foreground"
          onClick={() => setShowDecline(true)}
          disabled={loading !== null}
        >
          None of these work
        </Button>
      )}

      {showDecline && (
        <div className="space-y-2 pt-2 border-t">
          <p className="text-sm text-muted-foreground">
            Let your service provider know when you&apos;re available:
          </p>
          <textarea
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring min-h-[80px] resize-none"
            placeholder="e.g. I'm free weekday mornings or Saturday after 2pm"
            value={declineReason}
            onChange={(e) => setDeclineReason(e.target.value)}
          />
          <div className="flex gap-2">
            <Button
              onClick={submitDecline}
              disabled={!declineReason.trim() || loading !== null}
              className="flex-1 h-11"
            >
              {loading === 'decline' ? 'Sending…' : 'Send'}
            </Button>
            <Button
              variant="outline"
              className="h-11"
              onClick={() => setShowDecline(false)}
              disabled={loading !== null}
            >
              Cancel
            </Button>
          </div>
        </div>
      )}

      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
    </div>
  );
}
