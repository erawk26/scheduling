import { test, expect } from '@playwright/test';

test.describe('Offline Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/offline');
  });

  test('page loads at /offline', async ({ page }) => {
    await expect(page).toHaveURL('/offline');
  });

  test('shows offline heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: "You're Offline" })).toBeVisible();
  });

  test('shows offline message content', async ({ page }) => {
    await expect(
      page.getByText('No internet connection detected')
    ).toBeVisible();
  });

  test('shows list of what can be done offline', async ({ page }) => {
    await expect(page.getByText('View and edit your appointments')).toBeVisible();
    await expect(page.getByText('Manage clients and services')).toBeVisible();
    await expect(page.getByText('Create new records')).toBeVisible();
  });

  test('shows Try Again button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /try again/i })).toBeVisible();
  });
});
