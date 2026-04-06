import { test, expect } from '../fixtures/enhanced';

test.describe('Clients page', () => {
  test('loads at /dashboard/clients and shows heading', async ({ authPage }) => {
    await authPage.goto('/dashboard/clients');
    await expect(authPage.getByRole('heading', { name: 'Clients' })).toBeVisible();
  });

  test('shows "Add Client" button', async ({ authPage }) => {
    await authPage.goto('/dashboard/clients');
    await expect(authPage.getByRole('button', { name: /add client/i })).toBeVisible();
  });

  test('shows search input', async ({ authPage }) => {
    await authPage.goto('/dashboard/clients');
    await expect(authPage.getByPlaceholder(/search clients/i)).toBeVisible();
  });

  test('empty state shows no-clients message', async ({ authPage }) => {
    await authPage.goto('/dashboard/clients');
    const emptyMsg = authPage.getByText(/no clients added yet|you don't have any clients/i).first();
    await expect(emptyMsg).toBeVisible();
  });

  test('clicking "Add Client" opens dialog', async ({ authPage }) => {
    await authPage.goto('/dashboard/clients');
    await authPage.waitForLoadState('networkidle');
    await authPage.getByRole('button', { name: /add client/i }).first().click();
    await expect(authPage.getByRole('dialog')).toBeVisible({ timeout: 10000 });
    await expect(authPage.getByRole('heading', { name: /add new client/i })).toBeVisible();
  });
});

test.describe.serial('Clients CRUD', () => {
  const FIRST_NAME = 'E2EFirst';
  const LAST_NAME = `Last${Date.now()}`;
  const EMAIL = `e2e.${Date.now()}@test.com`;
  const PHONE = '(555) 000-1234';
  const UPDATED_FIRST = 'E2EUpdated';

  let clientDetailUrl = '';

  test('create client — fill form and submit', async ({ authPage, seedOfflineKit }) => {
    await authPage.goto('/dashboard/clients');
    await authPage.waitForLoadState('networkidle');
    await authPage.getByRole('button', { name: /add client/i }).first().click();
    await expect(authPage.getByRole('dialog')).toBeVisible({ timeout: 10000 });

    await authPage.getByLabel(/first name/i).fill(FIRST_NAME);
    await authPage.getByLabel(/last name/i).fill(LAST_NAME);
    await authPage.getByLabel(/email/i).fill(EMAIL);
    await authPage.getByLabel(/phone/i).fill(PHONE);

    await authPage.getByRole('button', { name: /create client/i }).click();

    await expect(authPage.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    await expect(authPage.getByText(`${FIRST_NAME} ${LAST_NAME}`)).toBeVisible({ timeout: 10000 });
  });

  test('client card shows email', async ({ authPage, seedOfflineKit }) => {
    await seedOfflineKit({
      clients: [{ id: '00000000-0000-4000-8000-000000000010', first_name: 'Email', last_name: 'Tester', email: EMAIL }],
    });

    await authPage.goto('/dashboard/clients');
    await expect(authPage.getByText(EMAIL)).toBeVisible({ timeout: 5000 });
  });

  test('clicking client card navigates to detail page', async ({ authPage, seedOfflineKit }) => {
    const clientId = crypto.randomUUID();
    await seedOfflineKit({
      clients: [{ id: clientId, first_name: 'Navigate', last_name: 'Test' }],
    });

    await authPage.goto('/dashboard/clients');
    await authPage.getByText('Navigate Test').click();
    await expect(authPage).toHaveURL(new RegExp(`/dashboard/clients/${clientId}`));
  });

  test('client detail page shows Pets section', async ({ authPage, seedOfflineKit }) => {
    const clientId = crypto.randomUUID();
    await seedOfflineKit({
      clients: [{ id: clientId, first_name: 'Pet', last_name: 'Owner' }],
    });

    await authPage.goto(`/dashboard/clients/${clientId}`);
    await expect(authPage.getByRole('heading', { name: /pets/i })).toBeVisible();
    await expect(authPage.getByRole('button', { name: /add pet/i })).toBeVisible();
  });

  test('add pet — fill name and species, submit', async ({ authPage, seedOfflineKit }) => {
    const clientId = crypto.randomUUID();
    await seedOfflineKit({
      clients: [{ id: clientId, first_name: 'AddPet', last_name: 'Client' }],
    });

    await authPage.goto(`/dashboard/clients/${clientId}`);
    await authPage.getByRole('button', { name: /add pet/i }).click();
    await expect(authPage.getByRole('dialog')).toBeVisible();

    await authPage.getByLabel(/name \*/i).fill('Buddy');
    // Species defaults to 'dog' — leave it

    await authPage.getByRole('button', { name: /create pet/i }).click();

    await expect(authPage.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    await expect(authPage.getByText('Buddy')).toBeVisible({ timeout: 5000 });
  });

  test('edit client — open edit form, change first name, save', async ({ authPage, seedOfflineKit }) => {
    const clientId = crypto.randomUUID();
    await seedOfflineKit({
      clients: [{ id: clientId, first_name: 'EditMe', last_name: 'Client' }],
    });

    await authPage.goto(`/dashboard/clients/${clientId}`);
    await authPage.getByRole('button', { name: /edit/i }).first().click();
    await expect(authPage.getByRole('dialog')).toBeVisible();
    await expect(authPage.getByRole('heading', { name: /edit client/i })).toBeVisible();

    const firstNameInput = authPage.getByLabel(/first name/i).first();
    await expect(firstNameInput).toHaveValue('EditMe');
    await firstNameInput.clear();
    await firstNameInput.fill(UPDATED_FIRST);

    await authPage.getByRole('button', { name: /update client/i }).click();

    await expect(authPage.getByRole('dialog')).not.toBeVisible({ timeout: 5000 });
    await expect(authPage.getByText(`${UPDATED_FIRST} Client`)).toBeVisible({ timeout: 5000 });
  });

  test('delete client — confirm removes client and redirects', async ({ authPage, seedOfflineKit }) => {
    const clientId = crypto.randomUUID();
    await seedOfflineKit({
      clients: [{ id: clientId, first_name: 'Delete', last_name: 'Me' }],
    });

    await authPage.goto(`/dashboard/clients/${clientId}`);

    // Click the destructive Delete button
    await authPage.getByRole('button', { name: /^delete$/i }).filter({ hasText: /delete/i }).first().click();
    await expect(authPage.getByRole('alertdialog')).toBeVisible();

    // Confirm deletion
    await authPage.getByRole('button', { name: /^delete$/i }).last().click();

    // Redirected back to clients list
    await authPage.waitForURL('/dashboard/clients', { timeout: 10000 });
    await expect(authPage.getByText('Delete Me')).not.toBeVisible();
  });
});

test.describe('Clients search', () => {
  test('searching filters the client list', async ({ authPage, seedOfflineKit }) => {
    await seedOfflineKit({
      clients: [
        { id: '00000000-0000-4000-8000-000000000020', first_name: 'Alpha', last_name: 'Client' },
        { id: '00000000-0000-4000-8000-000000000021', first_name: 'Beta', last_name: 'Client' },
      ],
    });

    await authPage.goto('/dashboard/clients');
    await authPage.waitForLoadState('networkidle');
    const search = authPage.getByPlaceholder(/search clients/i);
    await search.click();
    await search.fill('Alpha');
    await authPage.waitForTimeout(300);
    await expect(authPage.getByText('Alpha Client')).toBeVisible();
    await expect(authPage.getByText('Beta Client')).not.toBeVisible();
  });

  test('clearing search restores full list view', async ({ authPage, seedOfflineKit }) => {
    await seedOfflineKit({
      clients: [
        { id: '00000000-0000-4000-8000-000000000030', first_name: 'Clear', last_name: 'Test1' },
        { id: '00000000-0000-4000-8000-000000000031', first_name: 'Clear', last_name: 'Test2' },
      ],
    });

    await authPage.goto('/dashboard/clients');
    await authPage.waitForLoadState('networkidle');
    const search = authPage.getByPlaceholder(/search clients/i);
    await search.click();
    await search.fill('zzznomatch');
    await authPage.waitForTimeout(300);
    await expect(authPage.getByText(/no clients match|try a different/i)).toBeVisible({ timeout: 3000 });

    await search.clear();
    await authPage.waitForTimeout(300);
    await expect(authPage.getByRole('heading', { name: 'Clients' })).toBeVisible();
  });
});

test.describe('Clients form validation', () => {
  test('empty first name shows validation error', async ({ authPage }) => {
    await authPage.goto('/dashboard/clients');
    await authPage.waitForLoadState('networkidle');
    await authPage.getByRole('button', { name: /add client/i }).first().click();
    await expect(authPage.getByRole('dialog')).toBeVisible({ timeout: 10000 });

    // Leave first name empty, fill required last name
    await authPage.getByLabel(/last name/i).fill('Test');
    await authPage.getByRole('button', { name: /create client/i }).click();

    await expect(authPage.getByText(/first name is required/i)).toBeVisible({ timeout: 5000 });
  });

  test('empty last name shows validation error', async ({ authPage }) => {
    await authPage.goto('/dashboard/clients');
    await authPage.waitForLoadState('networkidle');
    await authPage.getByRole('button', { name: /add client/i }).first().click();
    await expect(authPage.getByRole('dialog')).toBeVisible({ timeout: 10000 });

    await authPage.getByLabel(/first name/i).fill('Test');
    await authPage.getByRole('button', { name: /create client/i }).click();

    await expect(authPage.getByText(/last name is required/i)).toBeVisible({ timeout: 5000 });
  });
});
