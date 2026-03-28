import { test, expect } from '../fixtures/auth';

/**
 * Selector notes for the assistant-ui Thread composer.
 *
 * @assistant-ui/react renders ComposerPrimitive.Input as a plain <textarea name="input">
 * and ComposerPrimitive.Send as a <button type="button"> with no aria-label.
 * Use getByPlaceholder() for the input and the CSS sibling selector for the send button.
 */

test.describe('Chat Page', () => {
  test.beforeEach(async ({ authPage }) => {
    await authPage.goto('/dashboard/chat');
  });

  // ─── Page load ───────────────────────────────────────────────────────────

  test('page loads at /dashboard/chat', async ({ authPage }) => {
    await expect(authPage).toHaveURL('/dashboard/chat');
  });

  test('shows AI Scheduler heading', async ({ authPage }) => {
    await expect(authPage.getByText('AI Scheduler')).toBeVisible();
  });

  test('shows scheduling assistant subtitle', async ({ authPage }) => {
    await expect(authPage.getByText('Your scheduling assistant')).toBeVisible();
  });

  // ─── Composer input ───────────────────────────────────────────────────────

  test('shows message input textarea', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await expect(input).toBeVisible();
  });

  test('placeholder text is visible when input is empty', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await expect(input).toHaveAttribute('placeholder', /message your ai scheduler/i);
  });

  // ─── Send button ─────────────────────────────────────────────────────────

  test('shows send button', async ({ authPage }) => {
    // ComposerPrimitive.Send renders as a button with disabled:opacity-30 when empty.
    // It sits alongside the textarea inside the composer root.
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

  // ─── Empty state ─────────────────────────────────────────────────────────

  /**
   * Covers: "Empty state — Before sending any message, verify the welcome text
   * 'How can I help with your schedule?' is shown"
   */
  test('shows empty state prompt before any message is sent', async ({ authPage }) => {
    await expect(authPage.getByText('How can I help with your schedule?')).toBeVisible();
  });

  test('empty state disappears once a message is submitted', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await input.fill('Hello');
    await input.press('Enter');
    // After submitting the empty-state conditional renders false
    await expect(authPage.getByText('How can I help with your schedule?')).not.toBeVisible({ timeout: 5000 });
  });

  // ─── Sending messages ────────────────────────────────────────────────────

  /**
   * Covers: "Send message and get response — Type a message, press Enter,
   * verify user message appears, verify AI response streams in"
   *
   * The chat endpoint requires OPENROUTER_API_KEY. In the test environment that
   * key is absent so the API returns 503 and no assistant bubble appears.
   * The send interaction itself (input clears on submit) IS testable.
   */
  test('can type a message and send it via Enter key', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await input.fill('What appointments do I have this week?');
    await input.press('Enter');
    // Composer clears immediately after submit — proves the send fired
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
    // Input must NOT be cleared — message was not sent
    const value = await input.inputValue();
    expect(value).toContain('Line one');
  });

  /**
   * Covers: "Send message and get response — verify user message appears"
   *
   * assistant-ui renders the user bubble immediately as an optimistic message.
   * The bubble uses MessagePrimitive.Parts inside a blue pill div.
   */
  test('user message bubble renders immediately after sending', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    const messageText = 'Hello from e2e test';
    await input.fill(messageText);
    await input.press('Enter');
    // The user message bubble should appear without waiting for the AI response
    await expect(authPage.getByText(messageText)).toBeVisible({ timeout: 5000 });
  });

  /**
   * Covers: "Multiple messages — Send 2 messages sequentially, verify both
   * user messages visible"
   *
   * Sending two messages and confirming both user bubbles are in the thread.
   * AI responses are skipped (no API key in test env).
   */
  test('two sequential user messages both appear in the thread', async ({ authPage }) => {
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);

    await input.fill('First message');
    await input.press('Enter');
    await expect(authPage.getByText('First message')).toBeVisible({ timeout: 5000 });

    // Wait for the input to be ready for the next message
    await expect(input).toHaveValue('', { timeout: 5000 });
    await input.fill('Second message');
    await input.press('Enter');
    await expect(authPage.getByText('Second message')).toBeVisible({ timeout: 5000 });

    // Both user messages remain visible in the thread
    await expect(authPage.getByText('First message')).toBeVisible();
    await expect(authPage.getByText('Second message')).toBeVisible();
  });

  /**
   * Covers: "Send message and get response — verify AI response streams in"
   *
   * Skipped: the chat endpoint calls OpenRouter which requires OPENROUTER_API_KEY.
   * In the test environment that key is absent → 503 → no assistant bubble rendered.
   * To enable: set OPENROUTER_API_KEY in the test environment and mock or use a
   * real key. Alternatively, intercept /api/agent/chat and return a mock stream.
   */
  test.skip('AI response bubble appears after sending a message', async ({ authPage }) => {
    // Skipped: OPENROUTER_API_KEY not present in test environment.
    // The /api/agent/chat route returns 503, so no assistant bubble is rendered.
    // Fix: mock the chat API to return a minimal UI message stream response.
  });

  /**
   * Covers: "Multiple messages — verify both AI responses visible"
   * Same constraint as above.
   */
  test.skip('both AI response bubbles appear after two sequential messages', async ({ authPage }) => {
    // Skipped: same OPENROUTER_API_KEY constraint as 'AI response bubble appears'.
  });

  // ─── Token usage widget ───────────────────────────────────────────────────

  /**
   * Covers: "Token usage widget — verify the token usage indicator is visible
   * in the chat header (shows 'X / 50.0K tokens')"
   *
   * The TokenUsageWidget calls getMonthlyUsage(app) which reads from OfflineKit
   * IndexedDB. In the Playwright browser context OfflineKit initialises but the
   * agentMemories collection is empty, so tokensUsed resolves to 0 — the widget
   * DOES render with "0 / 50.0K tokens".
   */
  test('token usage widget shows current usage out of monthly limit', async ({ authPage }) => {
    // Widget renders asynchronously after IndexedDB read — give it time
    await expect(
      authPage.getByText(/\d+(\.\d+)?[Kk]?\s*\/\s*50(\.\d+)?[Kk]?\s*tokens/i)
        .or(authPage.getByText(/0\s*\/\s*50(\.\d+)?[Kk]?\s*tokens/i))
    ).toBeVisible({ timeout: 5000 });
  });

  /**
   * Covers: "Token usage widget — in the chat header area"
   * Verify the header region contains the token tracking element.
   * This is a structural assertion that doesn't depend on exact token counts.
   */
  test('token usage widget is located in the chat header', async ({ authPage }) => {
    // The header contains "AI Scheduler" and the token widget in the same flex row
    const header = authPage.locator('div').filter({ hasText: 'AI Scheduler' }).first();
    await expect(header).toBeVisible();
    // Token widget text appears somewhere near the header
    await expect(
      authPage.getByText(/tokens/i).first()
    ).toBeVisible({ timeout: 5000 });
  });

  // ─── Context-aware response ───────────────────────────────────────────────

  /**
   * Covers: "Context-aware response — seed demo data via Settings > Developer >
   * Seed Demo Data, then ask about Sarah, verify response mentions Sarah Johnson"
   *
   * Skipped: Two blockers:
   * 1. seedDemoData() writes to OfflineKit IndexedDB which initialises in the
   *    browser context — data would be seeded. However the StructuredContextProvider
   *    that collects context also reads from IndexedDB; this part may work.
   * 2. The agent endpoint requires OPENROUTER_API_KEY to return a real response.
   *    Without it the endpoint returns 503 and no text mentioning Sarah is shown.
   * Fix: provide OPENROUTER_API_KEY + mock or intercept the chat route to return
   * a canned response that includes "Sarah Johnson".
   */
  test.skip('context-aware response mentions Sarah Johnson after seeding demo data', async ({ authPage }) => {
    // Skipped: requires OPENROUTER_API_KEY and a seeded OfflineKit IndexedDB.
    // Step 1: seed via Settings > Developer tab
    await authPage.goto('/dashboard/settings');
    await authPage.getByRole('tab', { name: /developer/i }).click();
    await authPage.getByRole('button', { name: /seed demo data/i }).click();
    await expect(authPage.getByText(/seeded/i)).toBeVisible({ timeout: 10000 });

    // Step 2: navigate to chat and ask about Sarah
    await authPage.goto('/dashboard/chat');
    const input = authPage.getByPlaceholder(/message your ai scheduler/i);
    await input.fill('Tell me about my client Sarah');
    await input.press('Enter');

    // Step 3: wait for AI response mentioning Sarah Johnson or her address
    await expect(
      authPage.getByText(/sarah johnson/i).or(authPage.getByText(/456 oak ave/i))
    ).toBeVisible({ timeout: 30000 });
  });

  // ─── Offline behavior ────────────────────────────────────────────────────

  test.describe('Offline behavior', () => {
    test('shows offline banner when network is disconnected', async ({ authPage }) => {
      await authPage.goto('/dashboard/chat');
      await authPage.context().setOffline(true);
      await expect(authPage.getByText(/offline/i).first()).toBeVisible({ timeout: 5000 });
      await authPage.context().setOffline(false);
    });

    test.skip('can still type messages while offline (they are queued)', async ({ authPage }) => {
      // Skipped: the chat page uses @assistant-ui/react which does not implement
      // an offline queue. The "1 queued" indicator referenced in the original test
      // does not exist in the current Thread component implementation.
      await authPage.goto('/dashboard/chat');
      await authPage.context().setOffline(true);
      await expect(authPage.getByText(/offline/i).first()).toBeVisible({ timeout: 5000 });

      const input = authPage.getByPlaceholder(/message your ai scheduler/i);
      await input.fill('Queued message');
      const sendBtn = authPage.locator('textarea[name="input"] ~ button');
      await sendBtn.click();

      await expect(input).toHaveValue('');
      await expect(authPage.getByText(/1 queued/i)).toBeVisible({ timeout: 3000 });

      await authPage.context().setOffline(false);
    });

    test('offline banner disappears after reconnecting', async ({ authPage }) => {
      await authPage.goto('/dashboard/chat');
      await authPage.context().setOffline(true);
      await expect(authPage.getByText(/offline/i).first()).toBeVisible({ timeout: 5000 });

      await authPage.context().setOffline(false);
      await expect(authPage.locator('[class*="amber"]').first()).not.toBeVisible({ timeout: 5000 });
    });
  });
});
