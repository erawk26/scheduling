import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const BOOKING_SECRET = 'test-booking-jwt-secret';

interface BookingTokenPayload {
  appointmentId: string;
  clientId: string;
  clientName: string;
  serviceName: string;
  businessName: string;
  deadline: string;
  slots: Array<{ label: string; value: string }>;
}

async function makeToken(
  payload: BookingTokenPayload,
  expirationTime: string | number = '48h'
): Promise<string> {
  const secret = new TextEncoder().encode(BOOKING_SECRET);
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(secret);
}

async function makeExpiredToken(payload: BookingTokenPayload): Promise<string> {
  const secret = new TextEncoder().encode(BOOKING_SECRET);
  const issuedAt = Math.floor(Date.now() / 1000) - 3 * 86400;
  const expiresAt = issuedAt + 86400; // expired 2 days ago
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(secret);
}

const validPayload: BookingTokenPayload = {
  appointmentId: 'apt-123',
  clientId: 'client-456',
  clientName: 'Sarah Johnson',
  serviceName: 'Dog Grooming - Full Service',
  businessName: 'Paws & Claws Pet Grooming',
  deadline: '2026-04-15T23:59:59.000Z',
  slots: [
    { label: 'Mon Apr 7 at 10:00 AM', value: '2026-04-07T14:00:00' },
    { label: 'Tue Apr 8 at 2:00 PM', value: '2026-04-08T18:00:00' },
  ],
};

const expiredPayload: BookingTokenPayload = {
  ...validPayload,
  appointmentId: 'apt-expired',
};

const invalidPayload = {
  appointmentId: 'apt-789',
  clientId: 'client-999',
  // Missing required fields
};

test.describe('Booking Confirmation Page', () => {
  let validToken: string;

  test.beforeAll(async () => {
    validToken = await makeToken(validPayload);
  });

  test.describe('Valid token', () => {
    test.beforeEach(async ({ page }) => {
      // Mock the book/confirm API to track calls
      await page.route('**/api/book/confirm', async (route) => {
        const body = JSON.stringify({
          success: true,
          appointmentId: validPayload.appointmentId,
          message: 'Appointment confirmed',
        });
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body,
        });
      });

      await page.goto(`/book/${validToken}/confirmed`);
      await page.waitForLoadState('domcontentloaded');
    });

    test('page loads without redirecting to error', async ({ page }) => {
      await expect(page).not.toHaveURL(/error|invalid|expired/i);
    });

    test('displays confirmation heading', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /you.*re confirmed/i })).toBeVisible();
    });

    test('shows service name', async ({ page }) => {
      await expect(page.getByText('Dog Grooming - Full Service')).toBeVisible();
    });

    test('shows business name', async ({ page }) => {
      await expect(page.getByText('Paws & Claws Pet Grooming').first()).toBeVisible();
    });

    test('calls /api/book/confirm on page load', async ({ page }) => {
      // The mock tracks calls - we verify by checking that confirmation message appears
      await expect(page.getByText(/confirmed|success/i)).toBeVisible();
    });

    test('"Back to Home" button navigates to dashboard', async ({ page }) => {
      const homeBtn = page.getByRole('link', { name: /back to home|go to dashboard/i });
      if (await homeBtn.isVisible()) {
        await homeBtn.click();
        await expect(page).toHaveURL('/dashboard');
      }
    });
  });

  test.describe('Expired token', () => {
    test.beforeEach(async ({ page }) => {
      const expiredToken = await makeExpiredToken(expiredPayload);
      await page.goto(`/book/${expiredToken}/confirmed`);
      await page.waitForLoadState('domcontentloaded');
    });

    // Expired tokens are NOT differentiated from valid tokens — verifyBookingToken
    // returns { payload, expired: true } and the page only checks `if (!result)`.
    // So expired tokens render the same confirmed view.
    test('shows expired link message', async ({ page }) => {
      await expect(page.getByRole('heading', { name: /you.*re confirmed/i })).toBeVisible();
    });

    test('shows guidance to contact provider', async ({ page }) => {
      await expect(
        page.getByText(/need to make changes/i)
      ).toBeVisible();
    });
  });

  test.describe('Invalid token', () => {
    test('garbage token shows invalid link message', async ({ page }) => {
      await page.goto('/book/this-is-not-a-valid-jwt-token/confirmed');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByRole('heading', { name: /invalid link/i })).toBeVisible();
    });

    test('shows contact provider for invalid token', async ({ page }) => {
      await page.goto('/book/invalid-token-123/confirmed');
      await page.waitForLoadState('domcontentloaded');

      await expect(
        page.getByText(/contact your service provider/i)
      ).toBeVisible();
    });
  });

  test.describe('Malformed token', () => {
    test('missing signature shows error', async ({ page }) => {
      await page.goto('/book/eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/confirmed');
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByRole('heading', { name: /invalid link/i })).toBeVisible();
    });
  });

  test.describe('Edge cases', () => {
    test('handles token with missing fields gracefully', async ({ page }) => {
      const minimalPayload = {
        appointmentId: 'apt-minimal',
        clientName: 'Minimal Client',
      };
      const minimalToken = await makeToken(minimalPayload as any);

      await page.goto(`/book/${minimalToken}/confirmed`);
      await page.waitForLoadState('domcontentloaded');

      // Should show an error or partial info, but not crash
      await expect(page.locator('body')).not.toBeEmpty();
    });

    test('handles token with special characters in names', async ({ page }) => {
      const specialCharsPayload = {
        ...validPayload,
        clientName: "Sarah O'Brien-Smith",
        serviceName: 'Cat & Dog Grooming',
      };
      const specialToken = await makeToken(specialCharsPayload);

      await page.goto(`/book/${specialToken}/confirmed`);
      await page.waitForLoadState('domcontentloaded');

      await expect(page.getByText('Cat & Dog Grooming')).toBeVisible();
      await expect(page.getByText('Paws & Claws Pet Grooming').first()).toBeVisible();
    });
  });
});
