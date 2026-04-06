import { test, expect } from '../fixtures/enhanced';

const mockForecasts = [
  {
    date: '2026-04-06',
    temp_high_f: 72,
    temp_low_f: 55,
    temp_current_f: 68,
    feels_like_f: 66,
    condition_icon: 'Sun',
    condition_label: 'Clear',
    precip_probability: 0,
    wind_speed_mph: 8,
    wind_gust_mph: 12,
    humidity: 45,
    uv_index: 6,
    is_outdoor_suitable: true,
  },
];

test.describe('Weather Page', () => {
  test.beforeEach(async ({ authPage, seedOfflineKit }) => {
    // Mock weather API — registered after setupAuth, so takes priority
    await authPage.route('**/api/weather/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          forecasts: mockForecasts,
          location: { lat: 40.7128, lon: -74.006 },
        }),
      });
    });

    // Seed business profile with coordinates so weather page has a location
    await seedOfflineKit({
      businessProfile: [
        {
          id: 'b0000000-0000-1000-8000-000000000001',
          business_name: 'Test Business',
          phone: null,
          timezone: 'America/New_York',
          service_area_miles: 25,
          business_latitude: 40.7128,
          business_longitude: -74.006,
        },
      ],
    });

    await authPage.goto('/dashboard/weather');
    await authPage.waitForLoadState('domcontentloaded');
  });

  test('page loads with correct URL', async ({ authPage }) => {
    await expect(authPage).toHaveURL('/dashboard/weather');
  });

  test('shows Weather heading', async ({ authPage }) => {
    await expect(authPage.getByRole('heading', { name: 'Weather' })).toBeVisible();
  });

  test('shows page description', async ({ authPage }) => {
    await expect(
      authPage.getByText('Weather-integrated scheduling for outdoor services')
    ).toBeVisible();
  });

  test('shows location toggle with Business and My Location buttons', async ({
    authPage,
  }) => {
    await expect(authPage.getByRole('button', { name: 'Business' })).toBeVisible();
    await expect(authPage.getByRole('button', { name: 'My Location' })).toBeVisible();
  });

  test('Business mode is active by default', async ({ authPage }) => {
    const businessBtn = authPage.getByRole('button', { name: 'Business' });
    // Active button has primary styling (bg-primary class), no aria-pressed
    await expect(businessBtn).toHaveClass(/bg-primary/);
  });

  test('shows current conditions card', async ({ authPage }) => {
    await expect(authPage.getByText('Current Conditions')).toBeVisible();
    await expect(authPage.getByText('68°F')).toBeVisible();
    await expect(authPage.getByText('Clear').first()).toBeVisible();
    await expect(authPage.getByText(/H: 72° \/ L: 55°/)).toBeVisible();
  });

  test('shows outdoor suitability badge', async ({ authPage }) => {
    await expect(authPage.getByText(/Outdoor Suitable/i)).toBeVisible();
  });

  test('shows 5-day forecast section', async ({ authPage }) => {
    await expect(authPage.getByText('5-Day Forecast')).toBeVisible();
    // Verify forecast data is rendered (72° high temperature)
    await expect(authPage.getByText('72°').first()).toBeVisible();
  });
});
