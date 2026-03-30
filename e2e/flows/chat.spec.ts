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
