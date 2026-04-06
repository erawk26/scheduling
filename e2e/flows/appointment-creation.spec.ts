import { test, expect } from '../fixtures/enhanced';

test.describe('Appointment Creation Flow', () => {
  test('complete appointment creation from schedule dialog', async ({
    authPage,
    seedOfflineKit,
  }) => {
    // Seed required data: clients, services
    await seedOfflineKit({
      clients: [
        { id: '10000000-0000-1000-8000-000000000001', first_name: 'Alice', last_name: 'Smith', email: 'alice@example.com' },
        { id: '10000000-0000-1000-8000-000000000002', first_name: 'Bob', last_name: 'Jones', email: 'bob@example.com' },
      ],
      services: [
        {
          id: '20000000-0000-1000-8000-000000000001',
          name: 'Dog Grooming',
          duration_minutes: 60,
          price_cents: 5000,
        },
        {
          id: '20000000-0000-1000-8000-000000000002',
          name: 'Cat Grooming',
          duration_minutes: 90,
          price_cents: 7500,
        },
      ],
    });

    // Navigate to appointments page
    await authPage.goto('/dashboard/appointments');
    await authPage.waitForLoadState('domcontentloaded');

    // Click "Schedule Appointment" button
    const scheduleBtn = authPage.getByRole('button', { name: /schedule appointment/i });
    await expect(scheduleBtn).toBeVisible();
    await scheduleBtn.click();

    // Dialog should open
    const dialog = authPage.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('heading', { name: /schedule appointment/i })).toBeVisible();

    // Select client from combobox (shadcn Command/Popover)
    const clientTrigger = dialog.getByRole('combobox', { name: /client/i });
    await clientTrigger.click();
    await authPage.getByRole('option', { name: /Alice Smith/i }).click();

    // Select service from combobox
    const serviceTrigger = dialog.getByRole('combobox', { name: /service/i });
    await serviceTrigger.click();
    await authPage.getByRole('option', { name: /Dog Grooming/i }).click();

    // Set date: use date picker
    const dateInput = dialog.getByLabel(/date/i);
    const appointmentDate = new Date();
    appointmentDate.setDate(appointmentDate.getDate() + 7); // 1 week from now
    const dateStr = appointmentDate.toISOString().split('T')[0]; // yyyy-MM-dd
    await dateInput.fill(dateStr);

    // Set start time
    const startTimeInput = dialog.getByLabel(/start time/i);
    await startTimeInput.fill('10:00');

    // End time should auto-calculate: start + duration = 11:00
    const endTimeInput = dialog.getByLabel(/end time/i);
    await expect(endTimeInput).toHaveValue('11:00', { timeout: 10000 });

    // Submit form
    const createBtn = dialog.getByRole('button', { name: /create appointment/i });
    await createBtn.click();

    // Dialog should close
    await expect(dialog).not.toBeVisible({ timeout: 5000 });

    // Verify appointment appears — switch to list view for full details
    const listViewBtn = authPage.getByRole('button', { name: /^list$/i });
    await listViewBtn.click();

    // Check "Upcoming" tab shows the appointment
    const upcomingTab = authPage.getByRole('tab', { name: /upcoming/i });
    await upcomingTab.click();

    await expect(authPage.getByText('Alice Smith')).toBeVisible({ timeout: 5000 });
    await expect(authPage.getByText(/Dog Grooming/i)).toBeVisible();
    await expect(authPage.getByText(/10:00 AM/i)).toBeVisible();
  });

  test('form validation prevents submission without client', async ({
    authPage,
    seedOfflineKit,
  }) => {
    await seedOfflineKit({
      services: [
        { id: '20000000-0000-1000-8000-000000000001', name: 'Grooming', duration_minutes: 60, price_cents: 5000 },
      ],
    });

    await authPage.goto('/dashboard/appointments');
    await authPage.waitForLoadState('domcontentloaded');
    await authPage.getByRole('button', { name: /schedule appointment/i }).click();

    const dialog = authPage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Try to submit without selecting client
    await dialog.getByRole('button', { name: /create appointment/i }).click();

    // Dialog should remain visible (validation error)
    await expect(dialog).toBeVisible({ timeout: 2000 });

    // Client select should show error state (we can check for red border or error text)
    // This depends on implementation, at minimum dialog stays open
  });

  test('form validation prevents end time before start time', async ({
    authPage,
    seedOfflineKit,
  }) => {
    await seedOfflineKit({
      clients: [{ id: '10000000-0000-1000-8000-000000000001', first_name: 'Test', last_name: 'Client' }],
      services: [
        { id: '20000000-0000-1000-8000-000000000001', name: 'Test Service', duration_minutes: 60, price_cents: 5000 },
      ],
    });

    await authPage.goto('/dashboard/appointments');
    await authPage.waitForLoadState('domcontentloaded');

    await authPage.getByRole('button', { name: /schedule appointment/i }).click();

    const dialog = authPage.getByRole('dialog');
    await expect(dialog).toBeVisible();

    // Select client and service via combobox
    await dialog.getByRole('combobox', { name: /client/i }).click();
    await authPage.getByRole('option', { name: /Test Client/i }).click();
    await dialog.getByRole('combobox', { name: /service/i }).click();
    await authPage.getByRole('option', { name: /Test Service/i }).click();

    // Set date
    const dateInput = dialog.getByLabel(/date/i);
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await dateInput.fill(tomorrow.toISOString().split('T')[0]);

    // Set start time
    await dialog.getByLabel(/start time/i).fill('15:00');

    // Manually set end time BEFORE start (3 PM)
    await dialog.getByLabel(/end time/i).fill('14:00');

    // Try to submit
    await dialog.getByRole('button', { name: /create appointment/i }).click();

    // Should remain open with error
    await expect(dialog).toBeVisible({ timeout: 2000 });

    // End time should still be 14:00 (error state)
    await expect(dialog.getByLabel(/end time/i)).toHaveValue('14:00');
  });

  test('appointment with pet shows pet selection', async ({
    authPage,
    seedOfflineKit,
  }) => {
    await seedOfflineKit({
      clients: [
        {
          id: '10000000-0000-1000-8000-000000000001',
          first_name: 'Alice',
          last_name: 'Smith',
        },
      ],
      pets: [
        {
          id: '40000000-0000-1000-8000-000000000001',
          client_id: '10000000-0000-1000-8000-000000000001',
          name: 'Buddy',
          species: 'dog',
          breed: 'Golden Retriever',
        },
      ],
      services: [
        { id: '20000000-0000-1000-8000-000000000001', name: 'Grooming', duration_minutes: 60, price_cents: 5000 },
      ],
    });

    await authPage.goto('/dashboard/appointments');
    await authPage.waitForLoadState('domcontentloaded');

    await authPage.getByRole('button', { name: /schedule appointment/i }).click();

    const dialog = authPage.getByRole('dialog');

    // Select client first via combobox (this should populate pet dropdown)
    await dialog.getByRole('combobox', { name: /client/i }).click();
    await authPage.getByRole('option', { name: /Alice Smith/i }).click();

    // Pet dropdown should now be visible/enabled
    const petSelect = dialog.getByLabel(/pet/i);
    await expect(petSelect).toBeVisible();

    // Select pet via combobox
    await petSelect.click();
    await authPage.getByRole('option', { name: /Buddy/i }).click();

    // Complete rest of form
    await dialog.getByRole('combobox', { name: /service/i }).click();
    await authPage.getByRole('option', { name: /Grooming/i }).click();

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const dateStr = tomorrow.toISOString().split('T')[0];
    await dialog.getByLabel(/date/i).fill(dateStr);
    await dialog.getByLabel(/start time/i).fill('10:00');

    // End time should auto-fill
    await expect(dialog.getByLabel(/end time/i)).toHaveValue('11:00', { timeout: 10000 });

    await dialog.getByRole('button', { name: /create appointment/i }).click();

    // Verify created — dialog should close and appointment should appear
    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(authPage.getByText('Alice Smith')).toBeVisible();
  });

  test('appointment without pet (service does not require pet)', async ({
    authPage,
    seedOfflineKit,
  }) => {
    await seedOfflineKit({
      clients: [{ id: '10000000-0000-1000-8000-000000000001', first_name: 'Alice', last_name: 'Smith' }],
      services: [
        { id: '20000000-0000-1000-8000-000000000001', name: 'Consultation', duration_minutes: 30, price_cents: 3000 },
      ],
    });

    await authPage.goto('/dashboard/appointments');
    await authPage.waitForLoadState('domcontentloaded');

    await authPage.getByRole('button', { name: /schedule appointment/i }).click();

    const dialog = authPage.getByRole('dialog');

    await dialog.getByRole('combobox', { name: /client/i }).click();
    await authPage.getByRole('option', { name: /Alice Smith/i }).click();
    await dialog.getByRole('combobox', { name: /service/i }).click();
    await authPage.getByRole('option', { name: /Consultation/i }).click();

    // Pet field should NOT appear for services that don't require pets
    const petField = dialog.getByLabel(/pet/i);
    await expect(petField).not.toBeVisible({ timeout: 2000 });

    // Complete rest of form
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    await dialog.getByLabel(/date/i).fill(tomorrow.toISOString().split('T')[0]);
    await dialog.getByLabel(/start time/i).fill('14:00');

    await dialog.getByRole('button', { name: /create appointment/i }).click();

    await expect(dialog).not.toBeVisible({ timeout: 5000 });
    await expect(authPage.getByText('Alice Smith')).toBeVisible();
  });

  test('multiple appointments can be created in sequence', async ({
    authPage,
    seedOfflineKit,
  }) => {
    await seedOfflineKit({
      clients: [{ id: '10000000-0000-1000-8000-000000000001', first_name: 'Alice', last_name: 'Smith' }],
      services: [
        { id: '20000000-0000-1000-8000-000000000001', name: 'Grooming', duration_minutes: 60, price_cents: 5000 },
      ],
    });

    await authPage.goto('/dashboard/appointments');
    await authPage.waitForLoadState('domcontentloaded');

    // Create two appointments in sequence
    for (let i = 0; i < 2; i++) {
      await authPage.getByRole('button', { name: /schedule appointment/i }).click();
      const dialog = authPage.getByRole('dialog');
      await dialog.getByRole('combobox', { name: /client/i }).click();
      await authPage.getByRole('option', { name: /Alice Smith/i }).click({ timeout: 5000 });
      await dialog.getByRole('combobox', { name: /service/i }).click();
      await authPage.getByRole('option', { name: /Grooming/i }).click({ timeout: 5000 });

      const date = new Date();
      date.setDate(date.getDate() + (i + 1)); // different days
      await dialog.getByLabel(/date/i).fill(date.toISOString().split('T')[0]);
      await dialog.getByLabel(/start time/i).fill(i === 0 ? '09:00' : '14:00');

      await dialog.getByRole('button', { name: /create appointment/i }).click();
      await expect(dialog).not.toBeVisible({ timeout: 5000 });
    }

    // Both appointments should be visible in list view
    const listViewBtn = authPage.getByRole('button', { name: /^list$/i });
    await listViewBtn.click();
    await authPage.getByRole('tab', { name: /upcoming/i }).click();

    // Two appointments with Alice Smith
    const aliceEntries = await authPage.getByText('Alice Smith').all();
    expect(aliceEntries.length).toBe(2);
  });
});
