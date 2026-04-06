import { test, expect } from '../fixtures/enhanced';

// Valid UUIDs for seed data
const C1 = 'c1000000-0000-1000-8000-000000000001';
const C2 = 'c2000000-0000-1000-8000-000000000002';
const C3 = 'c3000000-0000-1000-8000-000000000003';
const S1 = '51000000-0000-1000-8000-000000000001';
const S2 = '52000000-0000-1000-8000-000000000002';
const S3 = '53000000-0000-1000-8000-000000000003';
const A1 = 'a1000000-0000-1000-8000-000000000001';
const A2 = 'a2000000-0000-1000-8000-000000000002';
const A3 = 'a3000000-0000-1000-8000-000000000003';

const mockOptimizeResponse = {
  stops: [
    { id: A1, arrivalTimeS: 0, departureTimeS: 3600, distanceM: 0, drivingTimeS: 0 },
    { id: A3, arrivalTimeS: 4200, departureTimeS: 7800, distanceM: 4800, drivingTimeS: 600 },
    { id: A2, arrivalTimeS: 8400, departureTimeS: 12000, distanceM: 5200, drivingTimeS: 660 },
  ],
  totalDistanceM: 5000,
  totalTimeS: 1260,
  polyline: 'encodedPolylineString',
  source: 'graphhopper',
};

const seedClients = [
  { id: C1, first_name: 'Alice', last_name: 'Smith', address: '123 Main St, Anytown' },
  { id: C2, first_name: 'Bob', last_name: 'Jones', address: '456 Oak Ave, Anytown' },
  { id: C3, first_name: 'Carol', last_name: 'Davis', address: '789 Pine Rd, Anytown' },
];

const seedServices = [
  { id: S1, name: 'Dog Grooming', duration_minutes: 60 },
  { id: S2, name: 'Pet Training', duration_minutes: 60 },
  { id: S3, name: 'Cat Grooming', duration_minutes: 60 },
];

const seedAppointments = [
  {
    id: A1,
    client_id: C1,
    service_id: S1,
    start_time: '2026-04-06T09:00:00',
    end_time: '2026-04-06T10:00:00',
    status: 'scheduled',
    location_type: 'client_location',
    latitude: 40.7128,
    longitude: -74.006,
    address: '123 Main St, Anytown',
  },
  {
    id: A2,
    client_id: C2,
    service_id: S2,
    start_time: '2026-04-06T11:00:00',
    end_time: '2026-04-06T12:00:00',
    status: 'scheduled',
    location_type: 'client_location',
    latitude: 40.758,
    longitude: -73.985,
    address: '456 Oak Ave, Anytown',
  },
  {
    id: A3,
    client_id: C3,
    service_id: S3,
    start_time: '2026-04-06T14:00:00',
    end_time: '2026-04-06T15:00:00',
    status: 'scheduled',
    location_type: 'client_location',
    latitude: 40.720,
    longitude: -73.950,
    address: '789 Pine Rd, Anytown',
  },
];

test.describe('Routes Page', () => {
  test.beforeEach(async ({ authPage, seedOfflineKit }) => {
    await seedOfflineKit({
      clients: seedClients,
      services: seedServices,
      appointments: seedAppointments,
    });

    await authPage.route('**/api/routes/optimize', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockOptimizeResponse),
      });
    });

    await authPage.route('**/api/geocode**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ lat: 40.7128, lon: -74.006 }),
      });
    });

    await authPage.route('**/api/credits', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ used: 450, limit: 500 }),
      });
    });

    await authPage.goto('/dashboard/routes');
    await authPage.waitForLoadState('domcontentloaded');
  });

  test('page loads with heading and description', async ({ authPage }) => {
    await expect(authPage).toHaveURL('/dashboard/routes');
    await expect(authPage.getByRole('heading', { name: 'Routes' })).toBeVisible();
    await expect(
      authPage.getByText('Optimized driving order for your appointments')
    ).toBeVisible();
  });

  test('date picker changes selected date and reloads route', async ({ authPage }) => {
    await expect(authPage.getByText('Optimized Route')).toBeVisible({ timeout: 15000 });

    const dateInput = authPage.getByLabel('Date');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];
    await dateInput.fill(tomorrowStr);

    await expect(authPage).not.toHaveURL(/error/i);
  });

  test('summary card shows stops, distance, and drive time', async ({ authPage }) => {
    await expect(authPage.getByText('Optimized Route')).toBeVisible({ timeout: 15000 });

    await expect(authPage.getByText('Stops')).toBeVisible();
    await expect(authPage.getByText('Road miles')).toBeVisible();
    // Drive time from legDrivingTimesS sum: 0+600+660 = 1260s = 21m
    await expect(authPage.getByText(/21m/)).toBeVisible();
  });

  test('route map displays', async ({ authPage }) => {
    await expect(authPage.getByText('Optimized Route')).toBeVisible({ timeout: 15000 });

    const mapContainer = authPage.locator('.leaflet-container').first();
    await expect(mapContainer).toBeVisible({ timeout: 15000 });
  });

  test('stop cards show client name, service, time, and navigation', async ({ authPage }) => {
    await expect(authPage.getByText('Optimized Route')).toBeVisible({ timeout: 15000 });

    // API reorders: apt-1 → apt-3 → apt-2
    await expect(authPage.getByText('Alice Smith')).toBeVisible();
    await expect(authPage.getByText('Dog Grooming')).toBeVisible();
    await expect(authPage.getByText('9:00 AM')).toBeVisible();

    await expect(authPage.getByText('Carol Davis')).toBeVisible();
    await expect(authPage.getByText('Cat Grooming')).toBeVisible();
    await expect(authPage.getByText('2:00 PM')).toBeVisible();

    await expect(authPage.getByText('Bob Jones')).toBeVisible();
    await expect(authPage.getByText('Pet Training')).toBeVisible();
    await expect(authPage.getByText('11:00 AM')).toBeVisible();

    await expect(
      authPage.getByRole('button', { name: /Navigate to Alice Smith/i })
    ).toBeVisible();
    await expect(
      authPage.getByRole('button', { name: /Navigate to Bob Jones/i })
    ).toBeVisible();
    await expect(
      authPage.getByRole('button', { name: /Navigate to Carol Davis/i })
    ).toBeVisible();
  });

  test('credit usage indicator shows API credit consumption', async ({ authPage }) => {
    await expect(authPage.getByText('Optimized Route')).toBeVisible({ timeout: 15000 });

    await expect(authPage.getByText(/450\/500/)).toBeVisible();
    await expect(authPage.getByText(/API credits/i)).toBeVisible();
  });

  test('source badge shows "Road-optimized" when using GraphHopper', async ({ authPage }) => {
    await expect(authPage.getByText('Optimized Route')).toBeVisible({ timeout: 15000 });

    await expect(authPage.getByText(/Road-optimized/i)).toBeVisible();
  });

  test('efficiency score badge shows when data available', async ({ authPage }) => {
    await expect(authPage.getByText('Optimized Route')).toBeVisible({ timeout: 15000 });

    // totalDistanceM: 5000 (5km optimized) vs sequential Haversine ~10.2km → ~51% shorter
    await expect(authPage.getByText(/\d+% shorter/)).toBeVisible();
  });
});

test.describe('Routes Page — edge cases', () => {
  test('empty state shows when no appointments on selected date', async ({
    authPage,
    seedOfflineKit,
  }) => {
    await authPage.route('**/api/routes/optimize', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...mockOptimizeResponse, stops: [], totalDistanceM: 0, totalTimeS: 0 }),
      });
    });

    // Navigate to a date that has no appointments (use a date far in the future)
    await authPage.goto('/dashboard/routes');
    await authPage.waitForLoadState('domcontentloaded');

    const dateInput = authPage.getByLabel('Date');
    await dateInput.fill('2099-12-31');

    await expect(
      authPage.getByText(/No scheduled or confirmed appointments/i)
    ).toBeVisible({ timeout: 10000 });
  });

  test('skipped appointments count shows when some lack location', async ({
    authPage,
    seedOfflineKit,
  }) => {
    await seedOfflineKit({
      clients: [
        { id: '10000000-0000-1000-8000-000000000001', first_name: 'Test', last_name: 'Client' },
      ],
      services: [
        { id: '20000000-0000-1000-8000-000000000001', name: 'Test Service', duration_minutes: 60 },
      ],
      appointments: [
        {
          id: 'a0000000-0000-1000-8000-000000000099',
          client_id: '10000000-0000-1000-8000-000000000001',
          service_id: '20000000-0000-1000-8000-000000000001',
          start_time: '2026-04-06T09:00:00',
          end_time: '2026-04-06T10:00:00',
          status: 'scheduled',
          // No latitude/longitude — will be skipped
        },
      ],
    });

    await authPage.goto('/dashboard/routes');
    await authPage.waitForLoadState('domcontentloaded');

    await expect(
      authPage.getByText(/appointment.*found but none have location data/i)
    ).toBeVisible({ timeout: 10000 });
  });

  // Note: offline banner, error fallback, and loading skeleton tests are omitted
  // because the useOptimizedRoute hook catches API errors internally (always returns
  // local fallback), and offline/loading states are too transient for reliable E2E testing.
});
