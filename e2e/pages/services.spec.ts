import { test, expect } from '../fixtures/enhanced';

test.describe('Services page', () => {
  test('loads at /dashboard/services and shows heading', async ({ authPage }) => {
        await authPage.goto('/dashboard/services');
    await expect(authPage.getByRole('heading', { name: 'Services' })).toBeVisible();
  });

  test('shows "Add Service" button', async ({ authPage }) => {
        await authPage.goto('/dashboard/services');
    await expect(authPage.getByRole('button', { name: /add service/i }).first()).toBeVisible();
  });

  test('empty state shows prompt to add services', async ({ authPage }) => {
        await authPage.goto('/dashboard/services');
    const noServicesCard = authPage.getByText(/add service/i).first();
    await expect(noServicesCard).toBeVisible();
  });

  test('clicking "Add Service" opens the dialog', async ({ authPage }) => {
    await authPage.goto('/dashboard/services');
    await authPage.waitForLoadState('networkidle');
    await authPage.getByRole('button', { name: /add service/i }).first().click();
    await expect(authPage.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await expect(authPage.getByRole('heading', { name: /add service/i })).toBeVisible();
  });
});

test.describe.serial('Services CRUD', () => {
  const SERVICE_NAME = `E2E Service ${Date.now()}`;
  const UPDATED_NAME = `${SERVICE_NAME} Updated`;

  test('create service — fill form and submit', async ({ authPage }) => {
    await authPage.goto('/dashboard/services');
    await authPage.waitForLoadState('networkidle');
    await authPage.getByRole('button', { name: /add service/i }).first().click();
    await expect(authPage.getByRole('dialog')).toBeVisible({ timeout: 10000 });

    await authPage.getByLabel(/name \*/i).fill(SERVICE_NAME);
    await authPage.getByLabel(/duration/i).fill('60');
    await authPage.getByLabel(/price/i).fill('100');

    await authPage.getByRole('button', { name: /^create$/i }).click();

    await expect(authPage.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    await expect(authPage.getByText(SERVICE_NAME)).toBeVisible({ timeout: 5000 });
  });

  test('price displays in dollars format', async ({ authPage }) => {
        const priceDollars = 125.00;
    const priceCents = Math.round(priceDollars * 100);

    await authPage.goto('/dashboard/services');
    await authPage.getByRole('button', { name: /add service/i }).first().click();

    await authPage.getByLabel(/name \*/i).fill(`Price Test ${Date.now()}`);
    await authPage.getByLabel(/duration/i).fill('45');
    await authPage.getByLabel(/price/i).fill(priceDollars.toString());
    await authPage.getByRole('button', { name: /^create$/i }).click();

    await expect(authPage.getByText(`$${priceDollars.toFixed(2)}`)).toBeVisible({ timeout: 5000 });
  });

  test('edit service — form is pre-filled and name can be updated', async ({ authPage, seedOfflineKit }) => {
        const serviceId = crypto.randomUUID();
    await seedOfflineKit({
      services: [{ id: serviceId, name: SERVICE_NAME, duration_minutes: 45, price_cents: 5000 }],
    });

    await authPage.goto('/dashboard/services');
    const serviceCard = authPage.getByText(SERVICE_NAME).locator('../../../..');
    await serviceCard.getByRole('button', { name: /edit/i }).click();

    await expect(authPage.getByRole('dialog')).toBeVisible();
    await expect(authPage.getByRole('heading', { name: /edit service/i })).toBeVisible();

    const nameInput = authPage.getByLabel(/name \*/i);
    await expect(nameInput).toHaveValue(SERVICE_NAME);
    await nameInput.clear();
    await nameInput.fill(UPDATED_NAME);

    await authPage.getByRole('button', { name: /^update$/i }).click();

    await expect(authPage.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    await expect(authPage.getByText(UPDATED_NAME)).toBeVisible({ timeout: 5000 });
  });

  test('delete service — confirm removes it from the list', async ({ authPage, seedOfflineKit }) => {
        const serviceId = crypto.randomUUID();
    await seedOfflineKit({
      services: [{ id: serviceId, name: UPDATED_NAME, duration_minutes: 30, price_cents: 2500 }],
    });

    await authPage.goto('/dashboard/services');
    const serviceCard = authPage.getByText(UPDATED_NAME).locator('../../../..');
    await serviceCard.getByRole('button', { hasNot: authPage.getByText(/edit/i) }).last().click();

    await expect(authPage.getByRole('alertdialog')).toBeVisible();
    await authPage.getByRole('button', { name: /^delete$/i }).click();

    await expect(authPage.getByText(UPDATED_NAME)).not.toBeVisible({ timeout: 5000 });
  });
});

test.describe('Services form validation', () => {
  test('empty name shows validation error', async ({ authPage }) => {
    await authPage.goto('/dashboard/services');
    await authPage.waitForLoadState('networkidle');
    await authPage.getByRole('button', { name: /add service/i }).first().click();
    await expect(authPage.getByRole('dialog')).toBeVisible({ timeout: 10000 });

    // Leave name empty and try to submit
    await authPage.getByRole('button', { name: /^create$/i }).click();

    // Should show validation error
    await expect(authPage.getByText(/name is required/i)).toBeVisible({ timeout: 5000 });
  });
});
