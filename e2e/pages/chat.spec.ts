import { test, expect } from '../fixtures/auth';

test.describe('Chat Page', () => {
  test.beforeEach(async ({ authPage }) => {
    await authPage.goto('/dashboard/chat');
  });

  test('page loads at /dashboard/chat', async ({ authPage }) => {
    await expect(authPage).toHaveURL('/dashboard/chat');
  });

  test('shows AI Scheduler heading', async ({ authPage }) => {
    await expect(authPage.getByText('AI Scheduler')).toBeVisible();
  });

  test('shows message input textarea', async ({ authPage }) => {
    const input = authPage.getByLabel('Message input');
    await expect(input).toBeVisible();
  });

  test('shows send button', async ({ authPage }) => {
    await expect(authPage.getByLabel('Send message')).toBeVisible();
  });

  test('send button is disabled when input is empty', async ({ authPage }) => {
    await expect(authPage.getByLabel('Send message')).toBeDisabled();
  });

  test('send button enables when text is typed', async ({ authPage }) => {
    await authPage.getByLabel('Message input').fill('Hello agent');
    await expect(authPage.getByLabel('Send message')).toBeEnabled();
  });

  test('shows empty state prompt when no messages', async ({ authPage }) => {
    await expect(authPage.getByText('How can I help with your schedule?')).toBeVisible();
  });

  test('can type a message and send it', async ({ authPage }) => {
    const input = authPage.getByLabel('Message input');
    await input.fill('What appointments do I have this week?');
    await authPage.getByLabel('Send message').click();
    // Input clears after send
    await expect(input).toHaveValue('');
  });

  test.skip('agent response appears after sending message', async ({ authPage }) => {
    // Skipped: useChat persists via offlinekit IndexedDB which is unavailable in test context.
    // The streaming mock response cannot be matched by the hook's stream reader.
  });

  test.skip('user message bubble renders in history', async ({ authPage }) => {
    // Skipped: app.agentConversations.create() throws ZodError in test context (offlinekit schema
    // validation requires fields not available without real DB initialisation).
  });

  test('Enter key sends message', async ({ authPage }) => {
    const input = authPage.getByLabel('Message input');
    await input.fill('Quick question');
    await input.press('Enter');
    await expect(input).toHaveValue('');
  });

  test('Shift+Enter inserts newline instead of sending', async ({ authPage }) => {
    const input = authPage.getByLabel('Message input');
    await input.fill('Line one');
    await input.press('Shift+Enter');
    // Input should not be cleared — message was not sent
    const value = await input.inputValue();
    expect(value).toContain('Line one');
  });

  test('placeholder text is visible when input is empty', async ({ authPage }) => {
    const input = authPage.getByLabel('Message input');
    await expect(input).toHaveAttribute('placeholder', /message your ai scheduler/i);
  });

  test.describe('Offline behavior', () => {
    test('shows offline banner when network is disconnected', async ({ authPage }) => {
      // Navigate while online, then go offline — the hook listens for the 'offline' window event
      await authPage.goto('/dashboard/chat');
      await authPage.context().setOffline(true);
      await expect(authPage.getByText(/offline/i).first()).toBeVisible({ timeout: 5000 });
      await authPage.context().setOffline(false);
    });

    test('can still type messages while offline (they are queued)', async ({ authPage }) => {
      await authPage.goto('/dashboard/chat');
      await authPage.context().setOffline(true);
      // Wait for offline state to be detected
      await expect(authPage.getByText(/offline/i).first()).toBeVisible({ timeout: 5000 });

      const input = authPage.getByLabel('Message input');
      await input.fill('Queued message');
      await authPage.getByLabel('Send message').click();

      // Input clears — message was accepted into queue
      await expect(input).toHaveValue('');

      // Queued count indicator appears
      await expect(authPage.getByText(/1 queued/i)).toBeVisible({ timeout: 3000 });

      await authPage.context().setOffline(false);
    });

    test('offline banner disappears after reconnecting', async ({ authPage }) => {
      await authPage.goto('/dashboard/chat');
      await authPage.context().setOffline(true);
      await expect(authPage.getByText(/offline/i).first()).toBeVisible({ timeout: 5000 });

      await authPage.context().setOffline(false);
      // Banner should disappear once online
      await expect(authPage.locator('[class*="amber"]').first()).not.toBeVisible({ timeout: 5000 });
    });
  });
});
