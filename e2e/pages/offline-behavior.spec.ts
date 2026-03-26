import { test, expect } from '../fixtures/auth';

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

    // Go offline
    await authPage.context().setOffline(true);

    // Navigate back to dashboard — should work from cache / service worker
    await authPage.goto('/dashboard');
    // Page should still render (URL check is sufficient for cached navigation)
    await expect(authPage).toHaveURL('/dashboard');

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

    const input = authPage.getByLabel('Message input');
    await input.fill('Will this send later?');
    await expect(input).toHaveValue('Will this send later?');

    await authPage.context().setOffline(false);
  });

  test('offline: messages sent are queued (not dropped)', async ({ authPage }) => {
    await authPage.goto('/dashboard/chat');
    await authPage.context().setOffline(true);

    const input = authPage.getByLabel('Message input');
    await input.fill('Queued while offline');
    await authPage.getByLabel('Send message').click();

    // Input should clear — message accepted into queue
    await expect(input).toHaveValue('');

    // Queue count should appear in offline banner
    await expect(authPage.getByText(/1 queued/i)).toBeVisible({ timeout: 3000 });

    await authPage.context().setOffline(false);
  });
});
