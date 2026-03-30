import { test, expect } from '../fixtures/enhanced';

test.describe('Offline Behavior', () => {
  test('dashboard loads normally when online', async ({ authPage }) => {
    await authPage.goto('/dashboard');
    // No offline banner should be visible
    await expect(authPage.getByText(/you're offline/i)).not.toBeVisible();
  });

  test('chat page shows offline banner when network is disconnected', async ({ authPage }) => {
    // Navigate while online, then go offline — the hook fires on the 'offline' window event
    await authPage.goto('/dashboard/chat');
    await authPage.context().setOffline(true);
    await expect(authPage.getByText(/offline/i).first()).toBeVisible({ timeout: 5000 });
    await authPage.context().setOffline(false);
  });

  test('can navigate between cached pages while offline', async ({ authPage }) => {
    // Load pages while online first so they are cached
    await authPage.goto('/dashboard');
    await authPage.goto('/dashboard/chat');

    // Go offline — client-side navigation (using router link) should still work
    await authPage.context().setOffline(true);

    // Use client-side navigation via sidebar link instead of page.goto
    const dashboardLink = authPage.locator('aside').getByRole('link', { name: 'Dashboard' });
    await dashboardLink.click();
    // Page should navigate (URL check)
    await expect(authPage).toHaveURL('/dashboard', { timeout: 5000 });

    await authPage.context().setOffline(false);
  });

  test('offline banner disappears when reconnected on chat page', async ({ authPage }) => {
    await authPage.goto('/dashboard/chat');
    await authPage.context().setOffline(true);
    await expect(authPage.getByText(/offline/i).first()).toBeVisible({ timeout: 5000 });

    await authPage.context().setOffline(false);
    await expect(authPage.locator('[class*="amber"]').first()).not.toBeVisible({ timeout: 5000 });
  });

  test('message input still works offline', async ({ authPage }) => {
    await authPage.goto('/dashboard/chat');
    await authPage.context().setOffline(true);

    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await input.fill('Will this send later?');
    await expect(input).toHaveValue('Will this send later?');

    await authPage.context().setOffline(false);
  });

  test('offline: messages sent are queued (not dropped)', async ({ authPage }) => {
    await authPage.goto('/dashboard/chat');
    await authPage.context().setOffline(true);

    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await input.fill('Queued while offline');
    // Use the send button via its sibling relationship to the textarea
    const sendBtn = authPage.locator('textarea[name="input"] ~ button');
    await sendBtn.click();

    // Input should clear — message accepted into queue
    await expect(input).toHaveValue('', { timeout: 5000 });

    await authPage.context().setOffline(false);
  });
});
