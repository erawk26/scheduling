import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { fetchWeatherForecast } from '../service';
import type { TomorrowIoResponse } from '../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeHourlyEntry(date: string, hour: number, overrides: Partial<{
  temperature: number;
  temperatureApparent: number;
  humidity: number;
  precipitationProbability: number;
  windSpeed: number;
  windGust: number;
  weatherCode: number;
  uvIndex: number;
  cloudCover: number;
  visibility: number;
}> = {}) {
  return {
    time: `${date}T${String(hour).padStart(2, '0')}:00:00Z`,
    values: {
      temperature: 72,
      temperatureApparent: 70,
      humidity: 50,
      precipitationProbability: 10,
      windSpeed: 8,
      windGust: 12,
      weatherCode: 1000,
      uvIndex: 3,
      cloudCover: 20,
      visibility: 10,
      ...overrides,
    },
  };
}

function makeApiResponse(entries: ReturnType<typeof makeHourlyEntry>[]): TomorrowIoResponse {
  return {
    timelines: { hourly: entries },
    location: { lat: 40.7128, lon: -74.006 },
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchWeatherForecast', () => {
  beforeEach(() => {
    process.env.TOMORROW_IO_API_KEY = 'test-api-key';
  });

  afterEach(() => {
    delete process.env.TOMORROW_IO_API_KEY;
    vi.restoreAllMocks();
  });

  it('returns null when TOMORROW_IO_API_KEY is not set', async () => {
    delete process.env.TOMORROW_IO_API_KEY;
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result).toBeNull();
  });

  it('returns null on 401 (invalid API key)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 401, ok: false }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result).toBeNull();
  });

  it('returns null on 429 (rate limited)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 429, ok: false }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result).toBeNull();
  });

  it('returns null on other non-ok status', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ status: 500, ok: false }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result).toBeNull();
  });

  it('returns null when hourly timeline is empty', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ timelines: { hourly: [] }, location: { lat: 40, lon: -74 } }),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result).toBeNull();
  });

  it('returns null when timelines.hourly is missing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => ({ timelines: {}, location: { lat: 40, lon: -74 } }),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result).toBeNull();
  });

  it('returns up to 5 daily forecasts', async () => {
    const entries = [
      ...Array.from({ length: 24 }, (_, h) => makeHourlyEntry('2026-04-07', h)),
      ...Array.from({ length: 24 }, (_, h) => makeHourlyEntry('2026-04-08', h)),
      ...Array.from({ length: 24 }, (_, h) => makeHourlyEntry('2026-04-09', h)),
      ...Array.from({ length: 24 }, (_, h) => makeHourlyEntry('2026-04-10', h)),
      ...Array.from({ length: 24 }, (_, h) => makeHourlyEntry('2026-04-11', h)),
      ...Array.from({ length: 24 }, (_, h) => makeHourlyEntry('2026-04-12', h)), // 6th day — should be cut off
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result).toHaveLength(5);
  });

  it('aggregates hourly data into correct daily high/low temps', async () => {
    const entries = [
      makeHourlyEntry('2026-04-07', 6, { temperature: 60 }),
      makeHourlyEntry('2026-04-07', 12, { temperature: 80 }),
      makeHourlyEntry('2026-04-07', 18, { temperature: 75 }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result).not.toBeNull();
    expect(result![0]!.temp_high_f).toBe(80);
    expect(result![0]!.temp_low_f).toBe(60);
  });

  it('uses first hourly temperature as temp_current_f', async () => {
    const entries = [
      makeHourlyEntry('2026-04-07', 0, { temperature: 55 }),
      makeHourlyEntry('2026-04-07', 6, { temperature: 70 }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result![0]!.temp_current_f).toBe(55);
  });

  it('uses max precipitationProbability for the day', async () => {
    const entries = [
      makeHourlyEntry('2026-04-07', 6, { precipitationProbability: 20 }),
      makeHourlyEntry('2026-04-07', 12, { precipitationProbability: 65 }),
      makeHourlyEntry('2026-04-07', 18, { precipitationProbability: 30 }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result![0]!.precip_probability).toBe(65);
  });

  it('uses max wind speed for the day', async () => {
    const entries = [
      makeHourlyEntry('2026-04-07', 6, { windSpeed: 5 }),
      makeHourlyEntry('2026-04-07', 12, { windSpeed: 25 }),
      makeHourlyEntry('2026-04-07', 18, { windSpeed: 15 }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result![0]!.wind_speed_mph).toBe(25);
  });

  it('picks the dominant weather code (most frequent)', async () => {
    const entries = [
      makeHourlyEntry('2026-04-07', 6, { weatherCode: 1000 }),
      makeHourlyEntry('2026-04-07', 12, { weatherCode: 4001 }),
      makeHourlyEntry('2026-04-07', 18, { weatherCode: 4001 }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result![0]!.weather_code).toBe(4001);
    expect(result![0]!.condition_label).toBe('Rain');
  });

  it('breaks ties in weather code by preferring more severe (higher) code', async () => {
    const entries = [
      makeHourlyEntry('2026-04-07', 6, { weatherCode: 1000 }),
      makeHourlyEntry('2026-04-07', 12, { weatherCode: 4001 }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result![0]!.weather_code).toBe(4001);
  });

  it('maps unknown weather code to "Unknown" label', async () => {
    const entries = [makeHourlyEntry('2026-04-07', 12, { weatherCode: 9999 })];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result![0]!.condition_label).toBe('Unknown');
  });

  it('sets is_outdoor_suitable=true when conditions are good', async () => {
    const entries = [
      makeHourlyEntry('2026-04-07', 12, {
        temperature: 72,
        precipitationProbability: 10,
        windSpeed: 8,
      }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result![0]!.is_outdoor_suitable).toBe(true);
  });

  it('sets is_outdoor_suitable=false when precip is too high', async () => {
    const entries = [
      makeHourlyEntry('2026-04-07', 12, {
        temperature: 72,
        precipitationProbability: 60,
        windSpeed: 8,
      }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result![0]!.is_outdoor_suitable).toBe(false);
  });

  it('sets is_outdoor_suitable=false when wind is too high', async () => {
    const entries = [
      makeHourlyEntry('2026-04-07', 12, {
        temperature: 72,
        precipitationProbability: 10,
        windSpeed: 25,
      }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result![0]!.is_outdoor_suitable).toBe(false);
  });

  it('sets is_outdoor_suitable=false when temperature is below freezing', async () => {
    const entries = [
      makeHourlyEntry('2026-04-07', 12, {
        temperature: 25,
        precipitationProbability: 10,
        windSpeed: 8,
      }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result![0]!.is_outdoor_suitable).toBe(false);
  });

  it('sets is_outdoor_suitable=false when temperature exceeds 95F', async () => {
    const entries = [
      makeHourlyEntry('2026-04-07', 12, {
        temperature: 100,
        precipitationProbability: 10,
        windSpeed: 8,
      }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result![0]!.is_outdoor_suitable).toBe(false);
  });

  it('correctly separates entries across two different days', async () => {
    const entries = [
      makeHourlyEntry('2026-04-07', 12, { temperature: 70 }),
      makeHourlyEntry('2026-04-08', 12, { temperature: 55 }),
    ];
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse(entries),
    }));
    const result = await fetchWeatherForecast(40.7, -74.0);
    expect(result).toHaveLength(2);
    expect(result![0]!.date).toBe('2026-04-07');
    expect(result![1]!.date).toBe('2026-04-08');
  });

  it('includes location coords in the URL (integration check via fetch call)', async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      ok: true,
      json: async () => makeApiResponse([makeHourlyEntry('2026-04-07', 12)]),
    });
    vi.stubGlobal('fetch', mockFetch);
    await fetchWeatherForecast(51.5074, -0.1278);
    const calledUrl = mockFetch.mock.calls[0]![0] as string;
    expect(calledUrl).toContain('51.5074');
    expect(calledUrl).toContain('-0.1278');
  });
});
