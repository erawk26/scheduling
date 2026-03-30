import { test, expect } from '../fixtures/enhanced';

test.describe('Settings — Agent Profile', () => {
  test.beforeEach(async ({ authPage }) => {
    // Mock OfflineKit agentProfile reads so the page renders without a real DB
    await authPage.route('**/api/agent/**', async (route) => {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ response: 'ok', skill: null }),
      });
    });
    await authPage.goto('/dashboard/settings/profile');
  });

  test('page loads at /dashboard/settings/profile', async ({ authPage }) => {
    await expect(authPage).toHaveURL('/dashboard/settings/profile');
  });

  test('shows page heading', async ({ authPage }) => {
    await expect(authPage.getByRole('heading', { name: 'Agent Profile' })).toBeVisible();
  });

  test('shows all 7 collapsible sections', async ({ authPage }) => {
    await expect(authPage.getByText('Work Schedule')).toBeVisible();
    await expect(authPage.getByText('Service Area')).toBeVisible();
    await expect(authPage.getByText('Travel Rules')).toBeVisible();
    await expect(authPage.getByText('Client Rules')).toBeVisible();
    await expect(authPage.getByText('Personal Commitments')).toBeVisible();
    await expect(authPage.getByText('Business Rules')).toBeVisible();
    await expect(authPage.getByText('Priorities')).toBeVisible();
  });

  test('each section has a Save Section button', async ({ authPage }) => {
    const saveBtns = authPage.getByRole('button', { name: 'Save Section' });
    const count = await saveBtns.count();
    expect(count).toBeGreaterThanOrEqual(7);
  });

  test('each section has a Clear & Re-ask in Chat button', async ({ authPage }) => {
    const clearBtns = authPage.getByRole('button', { name: 'Clear & Re-ask in Chat' });
    const count = await clearBtns.count();
    expect(count).toBeGreaterThanOrEqual(7);
  });

  test('Work Schedule section has day toggle buttons', async ({ authPage }) => {
    // Day abbreviations rendered as buttons
    for (const day of ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']) {
      await expect(authPage.getByRole('button', { name: day })).toBeVisible();
    }
  });

  test('Work Schedule section has start and end time selects', async ({ authPage }) => {
    await expect(authPage.getByText('Start Time')).toBeVisible();
    await expect(authPage.getByText('End Time')).toBeVisible();
  });

  test('Work Schedule section has scheduling horizon input', async ({ authPage }) => {
    const horizonInput = authPage.locator('#horizon');
    await expect(horizonInput).toBeVisible();
    await expect(horizonInput).toHaveAttribute('type', 'number');
  });

  test('can toggle a day off in Work Schedule', async ({ authPage }) => {
    const monBtn = authPage.getByRole('button', { name: 'Mon' });
    await expect(monBtn).toBeVisible();
    // Click to deselect Monday
    await monBtn.click();
    // Click again to reselect
    await monBtn.click();
    await expect(monBtn).toBeVisible();
  });

  test('Clear & Re-ask button is visible in Work Schedule section', async ({ authPage }) => {
    // Work Schedule section has a "Clear & Re-ask in Chat" button
    const clearBtns = authPage.getByRole('button', { name: 'Clear & Re-ask in Chat' });
    await expect(clearBtns.first()).toBeVisible();
  });

  test('section collapses when header is clicked', async ({ authPage }) => {
    // Work Schedule section header — click to collapse
    await authPage.getByText('Work Schedule').click();
    // After collapse, horizon input should not be visible
    await expect(authPage.locator('#horizon')).not.toBeVisible();
  });

  test('section re-expands when header is clicked again', async ({ authPage }) => {
    await authPage.getByText('Work Schedule').click();
    await expect(authPage.locator('#horizon')).not.toBeVisible();
    await authPage.getByText('Work Schedule').click();
    await expect(authPage.locator('#horizon')).toBeVisible();
  });

  test('Service Area section has towns textarea', async ({ authPage }) => {
    await expect(authPage.locator('#towns')).toBeVisible();
  });

  test('Travel Rules section has max drive time input', async ({ authPage }) => {
    await expect(authPage.locator('#max_drive')).toBeVisible();
    await expect(authPage.locator('#max_drive')).toHaveAttribute('type', 'number');
  });

  test('Client Rules section has client notes textarea', async ({ authPage }) => {
    await expect(authPage.locator('#client_notes')).toBeVisible();
  });

  test('Personal Commitments section has commitments textarea', async ({ authPage }) => {
    await expect(authPage.locator('#commitments')).toBeVisible();
  });

  test('Business Rules section has min spacing input', async ({ authPage }) => {
    await expect(authPage.locator('#min_spacing')).toBeVisible();
  });

  test('Priorities section shows all four priority labels', async ({ authPage }) => {
    await expect(authPage.getByText('Minimize Driving')).toBeVisible();
    await expect(authPage.getByText('Maximize Bookings')).toBeVisible();
    await expect(authPage.getByText('Protect Days Off')).toBeVisible();
    await expect(authPage.getByText('Cluster by Area')).toBeVisible();
  });

  test('can fill Service Area towns and click Save Section', async ({ authPage }) => {
    await authPage.locator('#towns').fill('Downtown\nNorth Side');
    const saveBtns = authPage.getByRole('button', { name: 'Save Section' });
    // Service Area is 2nd section (index 1)
    await saveBtns.nth(1).click();
    // No crash — button remains present
    await expect(saveBtns.nth(1)).toBeVisible();
  });
});
