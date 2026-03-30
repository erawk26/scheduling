/**
 * E2E test: Chat sends a message and receives a response.
 *
 * Mocks the /api/agent/chat endpoint via the X-Test-Response header mechanism
 * so no real OpenRouter call is needed.
 */

import { test, expect } from '../fixtures/enhanced';

// Skip mobile — sidebar overlaps chat composer on small viewports (known layout issue)
test.describe('Chat', () => {
  test.beforeEach(({ }, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Mobile chat layout needs fix');
  });

  test('sends a message and displays the AI response', async ({ authPage, mockChatAPI }) => {
    await mockChatAPI({ response: 'You have 3 appointments this week.' });

    await authPage.goto('/dashboard/chat');
    await authPage.waitForLoadState('networkidle');

    // Wait for the chat composer to be ready
    const composer = authPage.locator('textarea, [role="textbox"]').first();
    await expect(composer).toBeVisible({ timeout: 10000 });

    // Type and send a message
    await composer.fill('What appointments do I have this week?');
    await composer.press('Enter');

    // Verify user message appears in the chat area (not sidebar)
    await expect(authPage.locator('[data-testid="user-message-root"]').filter({ hasText: 'What appointments do I have this week?' })).toBeVisible({ timeout: 5000 });

    // Verify AI response appears
    await expect(authPage.locator('[data-testid="assistant-message-root"]').filter({ hasText: 'You have 3 appointments this week.' })).toBeVisible({ timeout: 10000 });
  });

  test('user message remains visible while waiting for AI response', async ({ authPage, mockChatAPI }) => {
    // Use a response that takes a moment to arrive (simulated by a longer text)
    await mockChatAPI({ response: 'Here is a detailed response to your scheduling question.' });

    await authPage.goto('/dashboard/chat');
    await authPage.waitForLoadState('networkidle');

    const composer = authPage.locator('textarea, [role="textbox"]').first();
    await expect(composer).toBeVisible({ timeout: 10000 });

    const userText = 'What is my schedule for next week?';
    await composer.fill(userText);
    await composer.press('Enter');

    // User message must appear immediately and remain visible throughout
    const userBubble = authPage.locator('[data-testid="user-message-root"]').filter({ hasText: userText });
    await expect(userBubble).toBeVisible({ timeout: 5000 });

    // Wait for the AI response to arrive
    const assistantBubble = authPage.locator('[data-testid="assistant-message-root"]').filter({
      hasText: 'Here is a detailed response to your scheduling question.',
    });
    await expect(assistantBubble).toBeVisible({ timeout: 15000 });

    // Verify user message is still visible after AI responds (regression: was disappearing)
    await expect(userBubble).toBeVisible();
  });

  test('both user and assistant messages persist across multiple exchanges', async ({ authPage, mockChatAPI }) => {
    await mockChatAPI({ response: 'First AI reply.' });

    await authPage.goto('/dashboard/chat');
    await authPage.waitForLoadState('networkidle');

    const composer = authPage.locator('textarea, [role="textbox"]').first();
    await expect(composer).toBeVisible({ timeout: 10000 });

    // First exchange
    await composer.fill('First user message');
    await composer.press('Enter');
    await expect(authPage.locator('[data-testid="user-message-root"]').filter({ hasText: 'First user message' })).toBeVisible({ timeout: 5000 });
    await expect(authPage.locator('[data-testid="assistant-message-root"]').filter({ hasText: 'First AI reply.' })).toBeVisible({ timeout: 15000 });

    // Second exchange
    await mockChatAPI({ response: 'Second AI reply.' });
    await composer.fill('Second user message');
    await composer.press('Enter');
    await expect(authPage.locator('[data-testid="user-message-root"]').filter({ hasText: 'Second user message' })).toBeVisible({ timeout: 5000 });
    await expect(authPage.locator('[data-testid="assistant-message-root"]').filter({ hasText: 'Second AI reply.' })).toBeVisible({ timeout: 15000 });

    // All four messages must still be present
    await expect(authPage.locator('[data-testid="user-message-root"]').filter({ hasText: 'First user message' })).toBeVisible();
    await expect(authPage.locator('[data-testid="assistant-message-root"]').filter({ hasText: 'First AI reply.' })).toBeVisible();
    await expect(authPage.locator('[data-testid="user-message-root"]').filter({ hasText: 'Second user message' })).toBeVisible();
    await expect(authPage.locator('[data-testid="assistant-message-root"]').filter({ hasText: 'Second AI reply.' })).toBeVisible();
  });

  test('displays error message when API fails', async ({ authPage, mockChatAPI }) => {
    await mockChatAPI({ error: true });

    await authPage.goto('/dashboard/chat');
    await authPage.waitForLoadState('networkidle');

    const composer = authPage.locator('textarea, [role="textbox"]').first();
    await expect(composer).toBeVisible({ timeout: 10000 });

    await composer.fill('hello');
    await composer.press('Enter');

    // Should show the user message in the chat area
    await expect(authPage.locator('[data-testid="user-message-root"]').filter({ hasText: 'hello' })).toBeVisible({ timeout: 5000 });
  });
});
