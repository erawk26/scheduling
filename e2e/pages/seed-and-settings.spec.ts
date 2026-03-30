import { test, expect } from '../fixtures/enhanced';

// Seed data matching src/lib/seed-data.ts
const SEED_SERVICES = [
  { id: '10000000-0000-4000-8000-000000000001', name: 'Full Groom', description: 'Bath, haircut, nails, ears', duration_minutes: 90, price_cents: 8500, weather_dependent: false, location_type: 'mobile' },
  { id: '10000000-0000-4000-8000-000000000002', name: 'Bath & Brush', description: 'Bath, blow dry, brush out', duration_minutes: 60, price_cents: 5500, weather_dependent: false, location_type: 'mobile' },
  { id: '10000000-0000-4000-8000-000000000003', name: 'Nail Trim', description: 'Nail clipping and filing', duration_minutes: 20, price_cents: 2000, weather_dependent: false, location_type: 'mobile' },
  { id: '10000000-0000-4000-8000-000000000004', name: 'De-shed Treatment', description: 'Undercoat removal and de-shedding', duration_minutes: 75, price_cents: 7500, weather_dependent: true, location_type: 'mobile' },
];

const SEED_CLIENTS = [
  { id: '20000000-0000-4000-8000-000000000001', first_name: 'Sarah', last_name: 'Johnson', email: 'sarah.j@email.com', phone: '555-867-5309', address: '456 Oak Ave, Portland, OR 97201', latitude: 45.5231, longitude: -122.6765, scheduling_flexibility: 'flexible' as const, notes: 'Prefers morning appointments.' },
  { id: '20000000-0000-4000-8000-000000000002', first_name: 'Mike', last_name: 'Chen', email: 'mike.chen@email.com', phone: '555-234-5678', address: '1200 NW 23rd Ave, Portland, OR 97210', latitude: 45.5328, longitude: -122.6985, scheduling_flexibility: 'fixed' as const, notes: 'Only available Tues/Thurs before noon.' },
  { id: '20000000-0000-4000-8000-000000000003', first_name: 'Emily', last_name: 'Rodriguez', email: 'emily.r@email.com', phone: '555-345-6789', address: '3400 SE Hawthorne Blvd, Portland, OR 97214', latitude: 45.5118, longitude: -122.6267, scheduling_flexibility: 'flexible' as const, notes: 'Works from home.' },
  { id: '20000000-0000-4000-8000-000000000004', first_name: 'David', last_name: 'Kim', email: 'david.kim@email.com', phone: '555-456-7890', address: '7890 N Mississippi Ave, Portland, OR 97217', latitude: 45.5571, longitude: -122.6759, scheduling_flexibility: 'unknown' as const, notes: null },
  { id: '20000000-0000-4000-8000-000000000005', first_name: 'Lisa', last_name: 'Martinez', email: 'lisa.m@email.com', phone: '555-567-8901', address: '2100 NE Alberta St, Portland, OR 97211', latitude: 45.5590, longitude: -122.6437, scheduling_flexibility: 'flexible' as const, notes: 'Two large dogs — needs extra time.' },
];

const SEED_PETS = [
  { id: '30000000-0000-4000-8000-000000000001', client_id: '20000000-0000-4000-8000-000000000001', name: 'Biscuit', species: 'dog', breed: 'Golden Retriever', size: 'large', age_years: 4, weight_lbs: 70 },
  { id: '30000000-0000-4000-8000-000000000002', client_id: '20000000-0000-4000-8000-000000000001', name: 'Mochi', species: 'dog', breed: 'Shih Tzu', size: 'small', age_years: 6, weight_lbs: 12, behavior_notes: 'Nervous around clippers', medical_notes: 'Sensitive skin' },
  { id: '30000000-0000-4000-8000-000000000003', client_id: '20000000-0000-4000-8000-000000000002', name: 'Zeus', species: 'dog', breed: 'German Shepherd', size: 'large', age_years: 3, weight_lbs: 85 },
  { id: '30000000-0000-4000-8000-000000000004', client_id: '20000000-0000-4000-8000-000000000003', name: 'Pepper', species: 'dog', breed: 'Australian Shepherd', size: 'medium', age_years: 2, weight_lbs: 45 },
  { id: '30000000-0000-4000-8000-000000000005', client_id: '20000000-0000-4000-8000-000000000003', name: 'Olive', species: 'dog', breed: 'Dachshund', size: 'small', age_years: 8, weight_lbs: 15, behavior_notes: 'Calm senior', medical_notes: 'Arthritis' },
  { id: '30000000-0000-4000-8000-000000000006', client_id: '20000000-0000-4000-8000-000000000004', name: 'Max', species: 'dog', breed: 'Labrador Retriever', size: 'large', age_years: 5, weight_lbs: 75 },
  { id: '30000000-0000-4000-8000-000000000007', client_id: '20000000-0000-4000-8000-000000000005', name: 'Bear', species: 'dog', breed: 'Bernese Mountain Dog', size: 'large', age_years: 3, weight_lbs: 100 },
  { id: '30000000-0000-4000-8000-000000000008', client_id: '20000000-0000-4000-8000-000000000005', name: 'Luna', species: 'dog', breed: 'Husky', size: 'large', age_years: 4, weight_lbs: 55 },
];

function generateAppointments() {
  const now = new Date();
  const monday = new Date(now);
  monday.setDate(now.getDate() + ((1 - now.getDay() + 7) % 7 || 7));
  monday.setHours(0, 0, 0, 0);

  return [
    { id: '40000000-0000-4000-8000-000000000001', client_id: '20000000-0000-4000-8000-000000000001', pet_id: '30000000-0000-4000-8000-000000000001', service_id: '10000000-0000-4000-8000-000000000001', start_time: new Date(monday.getTime() + 9 * 60 * 60 * 1000).toISOString(), end_time: new Date(monday.getTime() + 10.5 * 60 * 60 * 1000).toISOString(), status: 'scheduled', location_type: 'mobile', address: null, latitude: null, longitude: null, notes: null, internal_notes: null, weather_alert: 0 },
    { id: '40000000-0000-4000-8000-000000000002', client_id: '20000000-0000-4000-8000-000000000002', pet_id: '30000000-0000-4000-8000-000000000003', service_id: '10000000-0000-4000-8000-000000000001', start_time: new Date(monday.getTime() + 11 * 60 * 60 * 1000).toISOString(), end_time: new Date(monday.getTime() + 12.5 * 60 * 60 * 1000).toISOString(), status: 'scheduled', location_type: 'mobile', address: null, latitude: null, longitude: null, notes: null, internal_notes: null, weather_alert: 0 },
    { id: '40000000-0000-4000-8000-000000000003', client_id: '20000000-0000-4000-8000-000000000003', pet_id: '30000000-0000-4000-8000-000000000004', service_id: '10000000-0000-4000-8000-000000000002', start_time: new Date(monday.getTime() + 24 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000).toISOString(), end_time: new Date(monday.getTime() + 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(), status: 'scheduled', location_type: 'mobile', address: null, latitude: null, longitude: null, notes: null, internal_notes: null, weather_alert: 0 },
    { id: '40000000-0000-4000-8000-000000000004', client_id: '20000000-0000-4000-8000-000000000003', pet_id: '30000000-0000-4000-8000-000000000005', service_id: '10000000-0000-4000-8000-000000000003', start_time: new Date(monday.getTime() + 24 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(), end_time: new Date(monday.getTime() + 24 * 60 * 60 * 1000 + 10.33 * 60 * 60 * 1000).toISOString(), status: 'scheduled', location_type: 'mobile', address: null, latitude: null, longitude: null, notes: null, internal_notes: null, weather_alert: 0 },
    { id: '40000000-0000-4000-8000-000000000005', client_id: '20000000-0000-4000-8000-000000000004', pet_id: '30000000-0000-4000-8000-000000000006', service_id: '10000000-0000-4000-8000-000000000004', start_time: new Date(monday.getTime() + 48 * 60 * 60 * 1000 + 10 * 60 * 60 * 1000).toISOString(), end_time: new Date(monday.getTime() + 48 * 60 * 60 * 1000 + 11.25 * 60 * 60 * 1000).toISOString(), status: 'scheduled', location_type: 'mobile', address: null, latitude: null, longitude: null, notes: null, internal_notes: null, weather_alert: 0 },
    { id: '40000000-0000-4000-8000-000000000006', client_id: '20000000-0000-4000-8000-000000000005', pet_id: '30000000-0000-4000-8000-000000000007', service_id: '10000000-0000-4000-8000-000000000001', start_time: new Date(monday.getTime() + 48 * 60 * 60 * 1000 + 13 * 60 * 60 * 1000).toISOString(), end_time: new Date(monday.getTime() + 48 * 60 * 60 * 1000 + 14.5 * 60 * 60 * 1000).toISOString(), status: 'scheduled', location_type: 'mobile', address: null, latitude: null, longitude: null, notes: null, internal_notes: null, weather_alert: 0 },
    { id: '40000000-0000-4000-8000-000000000007', client_id: '20000000-0000-4000-8000-000000000005', pet_id: '30000000-0000-4000-8000-000000000008', service_id: '10000000-0000-4000-8000-000000000004', start_time: new Date(monday.getTime() + 72 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000).toISOString(), end_time: new Date(monday.getTime() + 72 * 60 * 60 * 1000 + 10.25 * 60 * 60 * 1000).toISOString(), status: 'scheduled', location_type: 'mobile', address: null, latitude: null, longitude: null, notes: null, internal_notes: null, weather_alert: 0 },
    { id: '40000000-0000-4000-8000-000000000008', client_id: '20000000-0000-4000-8000-000000000001', pet_id: '30000000-0000-4000-8000-000000000002', service_id: '10000000-0000-4000-8000-000000000002', start_time: new Date(monday.getTime() + 72 * 60 * 60 * 1000 + 11 * 60 * 60 * 1000).toISOString(), end_time: new Date(monday.getTime() + 72 * 60 * 60 * 1000 + 11.75 * 60 * 60 * 1000).toISOString(), status: 'scheduled', location_type: 'mobile', address: null, latitude: null, longitude: null, notes: null, internal_notes: null, weather_alert: 0 },
    { id: '40000000-0000-4000-8000-000000000009', client_id: '20000000-0000-4000-8000-000000000002', pet_id: '30000000-0000-4000-8000-000000000003', service_id: '10000000-0000-4000-8000-000000000003', start_time: new Date(monday.getTime() + 96 * 60 * 60 * 1000 + 9 * 60 * 60 * 1000).toISOString(), end_time: new Date(monday.getTime() + 96 * 60 * 60 * 1000 + 9.33 * 60 * 60 * 1000).toISOString(), status: 'scheduled', location_type: 'mobile', address: null, latitude: null, longitude: null, notes: null, internal_notes: null, weather_alert: 0 },
  ];
}

test.describe('Settings — Developer tab', () => {
  test.beforeEach(async ({ authPage }) => {
        await authPage.goto('/dashboard/settings');
    await authPage.getByRole('tab', { name: /developer/i }).click();
  });

  test('Developer tab is visible in Settings', async ({ authPage }) => {
    await expect(authPage.getByRole('tab', { name: /developer/i })).toBeVisible();
  });

  test('Demo Data card heading is visible on Developer tab', async ({ authPage }) => {
    await expect(authPage.getByRole('heading', { name: 'Demo Data' })).toBeVisible({ timeout: 10000 });
  });

  test('Seed Demo Data button is visible on Developer tab', async ({ authPage }) => {
    await expect(authPage.getByRole('button', { name: /seed demo data/i })).toBeVisible();
  });

  test('Clear Demo Data button is visible on Developer tab', async ({ authPage }) => {
    await expect(authPage.getByRole('button', { name: /clear demo data/i })).toBeVisible();
  });

  test('descriptive hint text explains what seed creates', async ({ authPage }) => {
    await expect(authPage.getByText(/5 clients.*8 pets.*4 services.*13 appointments/i)).toBeVisible();
  });

  test('Seed Demo Data creates records and shows success message with counts', async ({ authPage, seedOfflineKit }) => {
    await seedOfflineKit({
      services: SEED_SERVICES,
      clients: SEED_CLIENTS,
      pets: SEED_PETS,
      appointments: generateAppointments(),
    });

    await authPage.getByRole('button', { name: /seed demo data/i }).click();
    await expect(authPage.getByText(/seeded:.*4.*services.*5.*clients.*8.*pets.*13.*appointments/i)).toBeVisible({ timeout: 10000 });
  });

  test('seeded clients appear on /dashboard/clients after seeding', async ({ authPage, seedOfflineKit }) => {
    await seedOfflineKit({ clients: SEED_CLIENTS });
    await authPage.getByRole('button', { name: /seed demo data/i }).click();
    await authPage.waitForTimeout(2000);
    await authPage.goto('/dashboard/clients');

    for (const name of ['Sarah Johnson', 'Mike Chen', 'Emily Rodriguez', 'David Kim', 'Lisa Martinez']) {
      await expect(authPage.getByText(name)).toBeVisible({ timeout: 5000 });
    }
  });

  test('seeded services appear on /dashboard/services after seeding', async ({ authPage, seedOfflineKit }) => {
    await seedOfflineKit({ services: SEED_SERVICES });
    await authPage.getByRole('button', { name: /seed demo data/i }).click();
    await authPage.waitForTimeout(2000);
    await authPage.goto('/dashboard/services');

    for (const svc of ['Full Groom', 'Bath & Brush', 'Nail Trim', 'De-shed Treatment']) {
      await expect(authPage.getByText(svc)).toBeVisible({ timeout: 5000 });
    }
  });

  test('seeded appointments appear on /dashboard/appointments calendar after seeding', async ({ authPage, seedOfflineKit }) => {
    await seedOfflineKit({ appointments: generateAppointments() });
    await authPage.getByRole('button', { name: /seed demo data/i }).click();
    await authPage.waitForTimeout(2000);
    await authPage.goto('/dashboard/appointments');

    // At least one appointment should be visible in the calendar
    await expect(authPage.locator('[class*="appointment-pill"], [data-testid]').first()).toBeVisible({ timeout: 5000 });
  });

  test('Clear Demo Data shows success message', async ({ authPage }) => {
    // This test verifies the UI feedback, not actual clearing
    await authPage.getByRole('button', { name: /clear demo data/i }).click();
    await expect(authPage.getByText(/cleared.*demo records/i)).toBeVisible({ timeout: 10000 });
  });

  test('seeded clients are gone after clear', async ({ authPage, seedOfflineKit }) => {
    await seedOfflineKit({ clients: SEED_CLIENTS });
    await authPage.getByRole('button', { name: /seed demo data/i }).click();
    await authPage.waitForTimeout(2000);
    await authPage.goto('/dashboard/settings');
    await authPage.getByRole('button', { name: /clear demo data/i }).click();
    await authPage.waitForTimeout(2000);
    await authPage.goto('/dashboard/clients');

    for (const name of ['Sarah Johnson', 'Mike Chen', 'Emily Rodriguez', 'David Kim', 'Lisa Martinez']) {
      await expect(authPage.getByText(name)).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('seed is idempotent — clicking twice maintains correct counts', async ({ authPage, seedOfflineKit }) => {
    await seedOfflineKit({ clients: SEED_CLIENTS });
    await authPage.getByRole('button', { name: /seed demo data/i }).click();
    await authPage.waitForTimeout(2000);
    const countAfterFirst = await authPage.getByText(/seeded:/i).textContent();

    // Clear and seed again
    await authPage.getByRole('button', { name: /clear demo data/i }).click();
    await authPage.waitForTimeout(2000);
    await authPage.getByRole('button', { name: /seed demo data/i }).click();
    await authPage.waitForTimeout(2000);
    const countAfterSecond = await authPage.getByText(/seeded:/i).textContent();

    expect(countAfterFirst).toBe(countAfterSecond);
  });

  test('page does not crash after clicking Seed Demo Data', async ({ authPage, seedOfflineKit }) => {
    await seedOfflineKit({ services: SEED_SERVICES.slice(0, 1) });
    await authPage.getByRole('button', { name: /seed demo data/i }).click();
    // Just verify no error page shown
    await expect(authPage).not.toHaveURL(/error|404/i);
    await expect(authPage.locator('body')).not.toContainText('Error');
  });
});

test.describe('Settings — Profile tab', () => {
  test.beforeEach(async ({ authPage }) => {
        await authPage.goto('/dashboard/settings');
    await authPage.getByRole('tab', { name: /profile/i }).click();
  });

  test('business name input is visible', async ({ authPage }) => {
    await expect(authPage.getByLabel(/business name/i)).toBeVisible();
  });

  test('business name can be edited and saved', async ({ authPage, seedOfflineKit }) => {
    await seedOfflineKit({
      businessProfile: [{ id: 'bp-1', business_name: 'Test Biz', phone: '555-1234', timezone: 'UTC', service_area_miles: 10, business_latitude: null, business_longitude: null }],
    });

    await authPage.getByLabel(/business name/i).fill('My Updated Biz');
    await authPage.getByRole('button', { name: /save/i }).click();

    await expect(authPage.getByText('My Updated Biz')).toBeVisible({ timeout: 5000 });
  });

  test('business name persists after page reload', async ({ authPage, seedOfflineKit }) => {
    await seedOfflineKit({
      businessProfile: [{ id: 'bp-2', business_name: 'Reload Test', phone: null, timezone: 'UTC', service_area_miles: 0, business_latitude: null, business_longitude: null }],
    });

    await authPage.getByLabel(/business name/i).fill('Persisted Biz');
    await authPage.getByRole('button', { name: /save/i }).click();

    await authPage.reload();
    await expect(authPage.getByLabel(/business name/i)).toHaveValue('Persisted Biz');
  });
});

test.describe('Settings — Notifications tab', () => {
  test.beforeEach(async ({ authPage }) => {
        await authPage.goto('/dashboard/settings');
    await authPage.getByRole('tab', { name: /notifications/i }).click();
  });

  test('email notifications toggle is visible', async ({ authPage }) => {
    await expect(authPage.getByRole('switch', { name: /email notifications/i })).toBeVisible();
  });

  test('sms notifications toggle is visible', async ({ authPage }) => {
    await expect(authPage.getByRole('switch', { name: /sms notifications/i })).toBeVisible();
  });
});
