/**
 * E2E tests: Chat scheduling context verification.
 *
 * Uses the app's own seedDemoData() to populate OfflineKit, then verifies
 * the AI agent receives correct appointment context in the system prompt.
 */

import { test, expect } from '../fixtures/enhanced';

test.describe('Chat scheduling context', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name === 'mobile', 'Mobile chat layout needs fix');
  });

  test('system prompt includes appointments with day-of-week and addresses', async ({ authPage }) => {
    // Navigate and seed demo data via OfflineKit's own API
    await authPage.goto('/dashboard/chat');
    await authPage.waitForLoadState('networkidle');

    // Seed using the app's seedDemoData function (runs through OfflineKit properly)
    await authPage.evaluate(async () => {
      const { seedDemoData } = await import('/src/lib/seed-data.ts');
      await seedDemoData();
    });

    // Intercept the chat API to capture the system prompt
    let capturedSystem = '';
    await authPage.route('**/api/agent/chat', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}');
        capturedSystem = body.system ?? '';
        await route.fulfill({
          status: 200,
          contentType: 'text/plain; charset=utf-8',
          body: 'I can see your full schedule for the week.',
        });
      } else {
        await route.continue();
      }
    });

    // Reload to pick up seeded data in context provider
    await authPage.goto('/dashboard/chat');
    await authPage.waitForLoadState('networkidle');

    const composer = authPage.locator('textarea, [role="textbox"]').first();
    await expect(composer).toBeVisible({ timeout: 10000 });

    await composer.fill('What appointments do I have this week?');
    await composer.press('Enter');

    await expect(authPage.locator('[data-testid="assistant-message-root"]').filter({
      hasText: 'I can see your full schedule',
    })).toBeVisible({ timeout: 15000 });

    // System prompt must contain seed data clients
    expect(capturedSystem, 'Should contain Sarah Johnson').toContain('Sarah Johnson');
    expect(capturedSystem, 'Should contain service name').toContain('Full Groom');

    // Must include day-of-week (from the context enrichment fix)
    const hasDayOfWeek = /Monday|Tuesday|Wednesday|Thursday|Friday/.test(capturedSystem);
    expect(hasDayOfWeek, 'Should contain day-of-week names').toBe(true);

    // Must include address info (from the context enrichment fix)
    expect(capturedSystem, 'Should contain address').toContain('Portland');
  });

  test('system prompt includes appointments across multiple days', async ({ authPage }) => {
    await authPage.goto('/dashboard/chat');
    await authPage.waitForLoadState('networkidle');

    await authPage.evaluate(async () => {
      const { seedDemoData } = await import('/src/lib/seed-data.ts');
      await seedDemoData();
    });

    let capturedSystem = '';
    await authPage.route('**/api/agent/chat', async (route) => {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() ?? '{}');
        capturedSystem = body.system ?? '';
        await route.fulfill({
          status: 200,
          contentType: 'text/plain; charset=utf-8',
          body: 'You have appointments on multiple days.',
        });
      } else {
        await route.continue();
      }
    });

    await authPage.goto('/dashboard/chat');
    await authPage.waitForLoadState('networkidle');

    const composer = authPage.locator('textarea, [role="textbox"]').first();
    await expect(composer).toBeVisible({ timeout: 10000 });

    await composer.fill('Can I swap my Monday and Wednesday appointments?');
    await composer.press('Enter');

    await expect(authPage.locator('[data-testid="assistant-message-root"]').filter({
      hasText: 'appointments on multiple days',
    })).toBeVisible({ timeout: 15000 });

    // Seed data has appointments on Monday AND Wednesday — both must be in context
    // (This was the exact user-reported bug: AI only saw Monday)
    expect(capturedSystem, 'Should contain Monday appointments').toContain('Monday');
    expect(capturedSystem, 'Should contain Wednesday appointments').toContain('Wednesday');

    // Multiple clients should be visible across both days
    const clientCount = ['Sarah Johnson', 'Mike Chen', 'Emily Rodriguez', 'David Kim', 'Lisa Martinez']
      .filter(name => capturedSystem.includes(name)).length;
    expect(clientCount, 'Should see multiple clients across days').toBeGreaterThanOrEqual(3);
  });
});
