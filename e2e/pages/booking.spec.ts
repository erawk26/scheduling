/**
 * Booking page E2E tests
 *
 * Public page — no auth required. Uses standard @playwright/test.
 * JWT tokens are generated via jose (HS256) with BOOKING_JWT_SECRET=test-booking-jwt-secret.
 */

import { test, expect } from '@playwright/test';
import { SignJWT } from 'jose';

const BOOKING_SECRET = 'test-booking-jwt-secret';

const TEST_PAYLOAD = {
  appointmentId: 'apt-1',
  clientId: 'client-1',
  clientName: 'Sarah',
  serviceName: 'Dog Grooming',
  businessName: 'Pet Pro',
  deadline: '2026-04-05T00:00:00.000Z',
  slots: [
    { label: 'Mon 9am', value: '2026-04-01T09:00:00' },
    { label: 'Tue 2pm', value: '2026-04-02T14:00:00' },
  ],
};

async function makeToken(
  payload: object,
  expirationTime: string | number = '48h'
): Promise<string> {
  const secret = new TextEncoder().encode(BOOKING_SECRET);
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expirationTime)
    .sign(secret);
}

async function makeExpiredToken(payload: object): Promise<string> {
  const secret = new TextEncoder().encode(BOOKING_SECRET);
  // Set issued at 3 days ago, expired 1 day ago
  const issuedAt = Math.floor(Date.now() / 1000) - 3 * 86400;
  const expiresAt = issuedAt + 86400; // expired 2 days ago
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt(issuedAt)
    .setExpirationTime(expiresAt)
    .sign(secret);
}

test.describe('Booking Page — valid token', () => {
  let validToken: string;

  test.beforeAll(async () => {
    validToken = await makeToken(TEST_PAYLOAD);
  });

  test.beforeEach(async ({ page }) => {
    // Mock the book/confirm API so slot selection does not hit a real backend
    await page.route('**/api/book/confirm', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ redirectTo: `/book/${validToken}/confirmed` }),
      });
    });
  });

  /** Navigate and wait for hydration so React click handlers are attached */
  async function gotoAndHydrate(page: import('@playwright/test').Page) {
    await page.goto(`/book/${validToken}`);
    // Wait for React hydration — slot buttons become interactive
    await page.waitForFunction(() => {
      const btn = document.querySelector('button');
      // React attaches __reactFiber or __reactInternalInstance on hydration
      return btn && Object.keys(btn).some((k) => k.startsWith('__react'));
    }, { timeout: 10000 });
  }

  test('page loads with valid token', async ({ page }) => {
    await page.goto(`/book/${validToken}`);
    await expect(page).toHaveURL(`/book/${validToken}`);
  });

  test('shows business name', async ({ page }) => {
    await page.goto(`/book/${validToken}`);
    await expect(page.getByText('Pet Pro').first()).toBeVisible();
  });

  test('shows client greeting', async ({ page }) => {
    await page.goto(`/book/${validToken}`);
    await expect(page.getByText(/hi sarah/i)).toBeVisible();
  });

  test('shows service name', async ({ page }) => {
    await page.goto(`/book/${validToken}`);
    await expect(page.getByText(/dog grooming/i)).toBeVisible();
  });

  test('shows time slot buttons', async ({ page }) => {
    await page.goto(`/book/${validToken}`);
    await expect(page.getByRole('button', { name: 'Mon 9am' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Tue 2pm' })).toBeVisible();
  });

  test('shows "Select a time slot" prompt', async ({ page }) => {
    await page.goto(`/book/${validToken}`);
    await expect(page.getByText('Select a time slot:')).toBeVisible();
  });

  test('shows "None of these work" button', async ({ page }) => {
    await page.goto(`/book/${validToken}`);
    await expect(page.getByRole('button', { name: /none of these work/i })).toBeVisible();
  });

  test('clicking a slot calls /api/book/confirm', async ({ page }) => {
    let confirmCalled = false;
    await page.route('**/api/book/confirm', async (route) => {
      confirmCalled = true;
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ redirectTo: `/book/${validToken}/confirmed` }),
      });
    });

    await gotoAndHydrate(page);
    await page.getByRole('button', { name: 'Mon 9am' }).click();

    await page.waitForTimeout(1000);
    expect(confirmCalled).toBe(true);
  });

  test('"None of these work" shows decline textarea', async ({ page }) => {
    await gotoAndHydrate(page);
    await page.getByRole('button', { name: /none of these work/i }).click();
    await expect(page.getByPlaceholder(/i'm free weekday mornings/i)).toBeVisible();
  });

  test('decline textarea accepts text input', async ({ page }) => {
    await gotoAndHydrate(page);
    await page.getByRole('button', { name: /none of these work/i }).click();
    const textarea = page.getByPlaceholder(/i'm free weekday mornings/i);
    await textarea.fill('I am free Saturday mornings');
    await expect(textarea).toHaveValue('I am free Saturday mornings');
  });

  test('decline send button is disabled when textarea is empty', async ({ page }) => {
    await gotoAndHydrate(page);
    await page.getByRole('button', { name: /none of these work/i }).click();
    // The Send button inside the decline form should be disabled when empty
    const sendBtn = page.getByRole('button', { name: 'Send' });
    await expect(sendBtn).toBeDisabled();
  });

  test('decline form has a Cancel button to hide it', async ({ page }) => {
    await gotoAndHydrate(page);
    await page.getByRole('button', { name: /none of these work/i }).click();
    const cancelBtn = page.getByRole('button', { name: 'Cancel' });
    await expect(cancelBtn).toBeVisible();
    await cancelBtn.click();
    // After cancel, "None of these work" button is visible again
    await expect(page.getByRole('button', { name: /none of these work/i })).toBeVisible();
  });
});

test.describe('Booking Page — expired token', () => {
  let expiredToken: string;

  test.beforeAll(async () => {
    expiredToken = await makeExpiredToken(TEST_PAYLOAD);
  });

  test('shows expired message', async ({ page }) => {
    await page.goto(`/book/${expiredToken}`);
    await expect(page.getByText(/booking link expired/i)).toBeVisible();
  });

  test('shows contact provider guidance for expired token', async ({ page }) => {
    await page.goto(`/book/${expiredToken}`);
    await expect(
      page.getByText(/contact your service provider to receive a new one/i)
    ).toBeVisible();
  });
});

test.describe('Booking Page — invalid token', () => {
  test('shows invalid link message for garbage token', async ({ page }) => {
    await page.goto('/book/this-is-not-a-valid-jwt-token');
    await expect(page.getByText(/invalid booking link/i)).toBeVisible();
  });

  test('shows contact provider guidance for invalid token', async ({ page }) => {
    await page.goto('/book/garbage');
    await expect(page.getByText(/contact your service provider/i)).toBeVisible();
  });
});
