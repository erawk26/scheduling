import { test, expect } from '@playwright/test';

test.describe('Sign Up Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-up');
  });

  test('page loads at /sign-up', async ({ page }) => {
    await expect(page).toHaveURL('/sign-up');
  });

  test('shows correct heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Create an account' })).toBeVisible();
  });

  test('shows first name input', async ({ page }) => {
    await expect(page.getByLabel('First Name')).toBeVisible();
  });

  test('shows last name input', async ({ page }) => {
    await expect(page.getByLabel('Last Name')).toBeVisible();
  });

  test('shows email input', async ({ page }) => {
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('shows password input', async ({ page }) => {
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('password field has type password', async ({ page }) => {
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('shows Create Account button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  test('shows link to sign-in page', async ({ page }) => {
    const signInLink = page.getByRole('link', { name: 'Sign in' });
    await expect(signInLink).toBeVisible();
    await expect(signInLink).toHaveAttribute('href', '/sign-in');
  });

  test('shows password minimum length hint', async ({ page }) => {
    await expect(page.getByText('Must be at least 8 characters')).toBeVisible();
  });

  test('password field enforces minLength of 8', async ({ page }) => {
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAttribute('minlength', '8');
  });

  test('empty form submission does not proceed (required fields)', async ({ page }) => {
    await page.getByRole('button', { name: 'Create Account' }).click();
    // Browser native required validation prevents submission
    await expect(page).toHaveURL('/sign-up');
  });

  test('shows "Already have an account?" text', async ({ page }) => {
    await expect(page.getByText('Already have an account?')).toBeVisible();
  });
});
