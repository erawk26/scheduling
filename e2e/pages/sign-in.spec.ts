import { test, expect } from '@playwright/test';

test.describe('Sign In Page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/sign-in');
  });

  test('page loads at /sign-in', async ({ page }) => {
    await expect(page).toHaveURL('/sign-in');
  });

  test('shows correct heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();
  });

  test('shows email input field', async ({ page }) => {
    await expect(page.getByLabel('Email')).toBeVisible();
  });

  test('shows password input field', async ({ page }) => {
    await expect(page.getByLabel('Password')).toBeVisible();
  });

  test('password field has type password', async ({ page }) => {
    const passwordInput = page.getByLabel('Password');
    await expect(passwordInput).toHaveAttribute('type', 'password');
  });

  test('shows Sign In button', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Sign In' })).toBeVisible();
  });

  test('shows link to sign-up page', async ({ page }) => {
    const signUpLink = page.getByRole('link', { name: 'Sign up' });
    await expect(signUpLink).toBeVisible();
    await expect(signUpLink).toHaveAttribute('href', '/sign-up');
  });

  test('email input accepts email type', async ({ page }) => {
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toHaveAttribute('type', 'email');
  });

  test('empty form submission does not proceed (required fields)', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign In' }).click();
    // Browser native required validation prevents submission — email field should be focused/invalid
    const emailInput = page.getByLabel('Email');
    await expect(emailInput).toBeVisible();
    // Page should remain on sign-in
    await expect(page).toHaveURL('/sign-in');
  });

  test('shows "Don\'t have an account?" text', async ({ page }) => {
    await expect(page.getByText("Don't have an account?")).toBeVisible();
  });
});
