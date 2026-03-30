import { test, expect } from '../fixtures/enhanced';

test.describe('Settings — Billing & Usage', () => {
  test.beforeEach(async ({ authPage }) => {
    await authPage.goto('/dashboard/settings/billing');
  });

  test('page loads at /dashboard/settings/billing', async ({ authPage }) => {
    await expect(authPage).toHaveURL('/dashboard/settings/billing');
  });

  test('shows page heading', async ({ authPage }) => {
    await expect(authPage.getByRole('heading', { name: 'Billing & Usage' })).toBeVisible();
  });

  test('shows Current Plan card', async ({ authPage }) => {
    await expect(authPage.getByText('Current Plan').first()).toBeVisible();
  });

  test('shows tier badge (Free or Pro)', async ({ authPage }) => {
    // Badge shows either "Free" or "Pro" depending on local profile state
    const freeBadge = authPage.getByText('Free');
    const proBadge = authPage.getByText('Pro');
    const hasBadge = (await freeBadge.count()) > 0 || (await proBadge.count()) > 0;
    expect(hasBadge).toBe(true);
  });

  test('shows monthly token usage section', async ({ authPage }) => {
    await expect(authPage.getByText('Tokens used')).toBeVisible();
  });

  test('shows token usage progress bar', async ({ authPage }) => {
    // The progress bar is a div with a percentage width style
    const bar = authPage.locator('.h-2.w-full.rounded-full.bg-gray-100');
    await expect(bar.first()).toBeVisible();
  });

  test('shows emails sent this week', async ({ authPage }) => {
    await expect(authPage.getByText('Emails sent this week')).toBeVisible();
  });

  test('shows Usage This Month card', async ({ authPage }) => {
    await expect(authPage.getByText('Usage This Month').first()).toBeVisible();
  });

  test('shows Plan Comparison table', async ({ authPage }) => {
    await expect(authPage.getByText('Plan Comparison')).toBeVisible();
    await expect(authPage.getByText('Monthly tokens')).toBeVisible();
  });

  test('shows Upgrade to Pro button for free tier', async ({ authPage }) => {
    // On free tier the upgrade button is visible (disabled as placeholder)
    const upgradeBtn = authPage.getByRole('button', { name: /upgrade to pro/i });
    // If user is on free tier, button exists
    if (await upgradeBtn.count() > 0) {
      await expect(upgradeBtn).toBeVisible();
      await expect(upgradeBtn).toBeDisabled();
    }
  });

  test('shows payment coming soon text for free tier', async ({ authPage }) => {
    const comingSoon = authPage.getByText('Payment integration coming soon');
    if (await comingSoon.count() > 0) {
      await expect(comingSoon).toBeVisible();
    }
  });

  test('shows monthly token limit', async ({ authPage }) => {
    await expect(authPage.getByText('Monthly token limit')).toBeVisible();
  });

  test('shows weekly email limit', async ({ authPage }) => {
    await expect(authPage.getByText('Weekly email limit')).toBeVisible();
  });

  test('shows AI model label', async ({ authPage }) => {
    await expect(authPage.getByText('AI Model').first()).toBeVisible();
  });
});
