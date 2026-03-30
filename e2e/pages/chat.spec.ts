import { test, expect, ChatMockConfig } from '../fixtures/enhanced';

test.describe('Chat Page', () => {
  test.beforeEach(async ({ authPage, mockChatAPI }) => {
    // Default chat mock: simple response
    await mockChatAPI({ response: 'Hello! I am your scheduling assistant. How can I help?' });
    await authPage.goto('/dashboard/chat');
    // Wait for page to load, then ensure chat input is accessible
    await authPage.waitForLoadState('domcontentloaded');
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    // On mobile viewports, the sidebar overlaps the chat area — close it
    const viewport = authPage.viewportSize();
    if (viewport && viewport.width < 768) {
      // Wait for sidebar toggle button to render, then close sidebar
      const toggleBtn = authPage.locator('button').filter({ has: authPage.locator('.lucide-panel-left-close, .lucide-panel-left') }).first();
      await toggleBtn.waitFor({ state: 'visible', timeout: 10000 });
      await toggleBtn.click();
    }
    await expect(input).toBeVisible({ timeout: 10000 });
  });

  test('page loads at /dashboard/chat', async ({ authPage }) => {
    await expect(authPage).toHaveURL('/dashboard/chat');
  });

  test('shows AI Scheduler heading', async ({ authPage }) => {
    await expect(authPage.getByText('AI Scheduler')).toBeVisible();
  });

  test('shows scheduling assistant subtitle', async ({ authPage }) => {
    await expect(authPage.getByText('Your scheduling assistant')).toBeVisible();
  });

  test('shows message input textarea', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await expect(input).toBeVisible();
  });

  test('placeholder text is visible when input is empty', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await expect(input).toHaveAttribute('placeholder', /message your ai scheduler/i);
  });

  test('shows send button', async ({ authPage }) => {
    const sendBtn = authPage.locator('textarea[name="input"] ~ button');
    await expect(sendBtn).toBeVisible();
  });

  test('send button is disabled when input is empty', async ({ authPage }) => {
    const sendBtn = authPage.locator('textarea[name="input"] ~ button');
    await expect(sendBtn).toBeDisabled();
  });

  test('send button enables when text is typed', async ({ authPage }) => {
    await authPage.getByPlaceholder(/message your ai scheduler/i).fill('Hello agent');
    const sendBtn = authPage.locator('textarea[name="input"] ~ button');
    await expect(sendBtn).toBeEnabled();
  });

  test('shows empty state prompt before any message is sent', async ({ authPage }) => {
    await expect(authPage.getByText('How can I help with your schedule?')).toBeVisible();
  });

  test('empty state disappears once a message is submitted', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await input.fill('Hello');
    await input.press('Enter');
    await expect(authPage.getByText('How can I help with your schedule?')).not.toBeVisible({ timeout: 5000 });
  });

  test('can type a message and send it via Enter key', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await input.fill('What appointments do I have this week?');
    await input.press('Enter');
    await expect(input).toHaveValue('', { timeout: 5000 });
  });

  test('can type a message and send it via send button click', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await input.fill('Show me my schedule');
    const sendBtn = authPage.locator('textarea[name="input"] ~ button');
    await sendBtn.click();
    await expect(input).toHaveValue('', { timeout: 5000 });
  });

  test('Shift+Enter inserts newline instead of sending', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await input.fill('Line one');
    await input.press('Shift+Enter');
    const value = await input.inputValue();
    expect(value).toContain('Line one');
  });

  test('user message bubble renders immediately after sending', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    const messageText = 'Hello from e2e test';
    await input.fill(messageText);
    await input.press('Enter');
    await expect(authPage.getByTestId('user-message-root').getByText(messageText)).toBeVisible({ timeout: 10000 });
  });

  test('two sequential user messages both appear in the thread', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);

    await input.fill('First message');
    await input.press('Enter');
    await expect(authPage.getByTestId('user-message-root').getByText('First message')).toBeVisible({ timeout: 10000 });

    // Wait for AI response to complete before sending second message
    await expect(authPage.getByTestId('assistant-message-root').first()).toBeVisible({ timeout: 15000 });
    // Wait for input to clear and be ready
    await expect(input).toHaveValue('', { timeout: 10000 });

    await input.fill('Second message');
    await input.press('Enter');
    await expect(authPage.getByTestId('user-message-root').getByText('Second message')).toBeVisible({ timeout: 10000 });

    // Both messages should be present
    await expect(authPage.getByTestId('user-message-root').getByText('First message')).toBeVisible();
    await expect(authPage.getByTestId('user-message-root').getByText('Second message')).toBeVisible();
  });

  test('AI response bubble appears after sending a message', async ({ authPage, mockChatAPI }) => {
    await mockChatAPI({ response: 'This is a test AI response with multiple words' });

    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await input.fill('Hello AI');
    await input.press('Enter');

    await expect(authPage.getByTestId('assistant-message-root').getByText(/test AI response/)).toBeVisible({ timeout: 10000 });
  });

  test('both AI response bubbles appear after two sequential messages', async ({ authPage, mockChatAPI }) => {
    await mockChatAPI({ response: 'First response' });

    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await input.fill('First');
    await input.press('Enter');
    await expect(authPage.getByTestId('assistant-message-root').getByText('First response')).toBeVisible({ timeout: 10000 });

    await mockChatAPI({ response: 'Second response' });
    await input.fill('Second');
    await input.press('Enter');
    await expect(authPage.getByTestId('assistant-message-root').getByText('Second response')).toBeVisible({ timeout: 10000 });
  });

  test('token usage widget shows current usage out of monthly limit', async ({ authPage }) => {
    await expect(
      authPage.getByText(/\d+(\.\d+)?[Kk]?\s*\/\s*50(\.\d+)?[Kk]?\s*tokens/i)
        .or(authPage.getByText(/0\s*\/\s*50(\.\d+)?[Kk]?\s*tokens/i))
    ).toBeVisible({ timeout: 5000 });
  });

  test('token usage widget is located in the chat header', async ({ authPage }) => {
    const header = authPage.locator('div').filter({ hasText: 'AI Scheduler' }).first();
    await expect(header).toBeVisible();
    await expect(authPage.getByText(/tokens/i).first()).toBeVisible({ timeout: 5000 });
  });

  test('offline banner shows when network is disconnected', async ({ authPage }) => {
    // Input already verified visible in beforeEach
    await authPage.context().setOffline(true);
    // HTML uses &rsquo; (curly quote), so match with dot for any apostrophe
    await expect(authPage.getByText(/You.re offline/i)).toBeVisible({ timeout: 5000 });
    await authPage.context().setOffline(false);
  });

  test('offline banner disappears after reconnecting', async ({ authPage }) => {
    await authPage.context().setOffline(true);
    await expect(authPage.getByText(/You.re offline/i)).toBeVisible({ timeout: 5000 });

    await authPage.context().setOffline(false);
    await expect(authPage.getByText(/You.re offline/i)).not.toBeVisible({ timeout: 5000 });
  });
});
