/**
 * Weather Service - Tomorrow.io API Client (Server-side only)
 *
 * Fetches weather forecasts and maps to our simplified format.
 * Must only be used in server-side code (API routes).
 */

import {
  type TomorrowIoResponse,
  type TomorrowIoHourlyEntry,
  type WeatherForecast,
  WEATHER_CODES,
  isOutdoorSuitable,
} from './types';

const TOMORROW_IO_BASE_URL = 'https://api.tomorrow.io/v4/weather/forecast';

interface DailyAggregation {
  date: string;
  temps: number[];
  feelsLike: number[];
  humidity: number[];
  precipProb: number[];
  windSpeed: number[];
  windGust: number[];
  weatherCodes: number[];
  uvIndex: number[];
}

/**
 * Aggregate hourly intervals into daily forecasts
 */
function aggregateDaily(
  entries: TomorrowIoHourlyEntry[]
): DailyAggregation[] {
  const byDate = new Map<string, DailyAggregation>();

  for (const interval of entries) {
    const date = interval.time.slice(0, 10); // YYYY-MM-DD
    const v = interval.values;

    if (!byDate.has(date)) {
      byDate.set(date, {
        date,
        temps: [],
        feelsLike: [],
        humidity: [],
        precipProb: [],
        windSpeed: [],
        windGust: [],
        weatherCodes: [],
        uvIndex: [],
      });
    }

    const day = byDate.get(date)!;
    day.temps.push(v.temperature);
    day.feelsLike.push(v.temperatureApparent);
    day.humidity.push(v.humidity);
    day.precipProb.push(v.precipitationProbability);
    day.windSpeed.push(v.windSpeed);
    day.windGust.push(v.windGust);
    day.weatherCodes.push(v.weatherCode);
    day.uvIndex.push(v.uvIndex);
  }

  return Array.from(byDate.values());
}

function avg(nums: number[]): number {
  return nums.length === 0 ? 0 : nums.reduce((a, b) => a + b, 0) / nums.length;
}

function maxVal(nums: number[]): number {
  return nums.length === 0 ? 0 : Math.max(...nums);
}

function minVal(nums: number[]): number {
  return nums.length === 0 ? 0 : Math.min(...nums);
}

/**
 * Pick the most representative weather code for the day.
 * Prefers the most "severe" code (highest frequency of non-clear codes,
 * falling back to the most common code).
 */
function dominantWeatherCode(codes: number[]): number {
  const freq = new Map<number, number>();
  for (const c of codes) {
    freq.set(c, (freq.get(c) || 0) + 1);
  }

  // Sort by frequency descending, then by code descending (more severe)
  const sorted = Array.from(freq.entries()).sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return b[0] - a[0];
  });

  return sorted[0]?.[0] ?? 1000;
}

function buildForecast(agg: DailyAggregation): WeatherForecast {
  const code = dominantWeatherCode(agg.weatherCodes);
  const codeInfo = WEATHER_CODES[code] ?? { label: 'Unknown', icon: 'Cloud' };
  const tempHigh = Math.round(maxVal(agg.temps));
  const tempLow = Math.round(minVal(agg.temps));
  const tempCurrent = Math.round(agg.temps[0] ?? avg(agg.temps));
  const feelsLike = Math.round(avg(agg.feelsLike));
  const precipProb = Math.round(maxVal(agg.precipProb));
  const windSpeed = Math.round(maxVal(agg.windSpeed));
  const windGust = Math.round(maxVal(agg.windGust));

  return {
    date: agg.date,
    temp_high_f: tempHigh,
    temp_low_f: tempLow,
    temp_current_f: tempCurrent,
    feels_like_f: feelsLike,
    humidity: Math.round(avg(agg.humidity)),
    precip_probability: precipProb,
    wind_speed_mph: windSpeed,
    wind_gust_mph: windGust,
    weather_code: code,
    condition_label: codeInfo.label,
    condition_icon: codeInfo.icon,
    is_outdoor_suitable: isOutdoorSuitable(precipProb, windSpeed, tempHigh),
    uv_index: Math.round(maxVal(agg.uvIndex)),
  };
}

/**
 * Fetch 5-day weather forecast from Tomorrow.io
 *
 * @returns Array of daily forecasts, or null if API is unavailable
 */
export async function fetchWeatherForecast(
  lat: number,
  lon: number
): Promise<WeatherForecast[] | null> {
  const apiKey = process.env.TOMORROW_IO_API_KEY;
  if (!apiKey) {
    console.error('TOMORROW_IO_API_KEY is not configured');
    return null;
  }

  const url = new URL(TOMORROW_IO_BASE_URL);
  url.searchParams.set('location', `${lat},${lon}`);
  url.searchParams.set('units', 'imperial');
  url.searchParams.set('apikey', apiKey);

  const response = await fetch(url.toString(), {
    headers: { Accept: 'application/json' },
    next: { revalidate: 1800 }, // 30 minute cache
  });

  if (response.status === 401) {
    console.error('Tomorrow.io API: Invalid API key');
    return null;
  }

  if (response.status === 429) {
    console.error('Tomorrow.io API: Rate limited');
    return null;
  }

  if (!response.ok) {
    console.error(`Tomorrow.io API error: ${response.status}`);
    return null;
  }

  const data = (await response.json()) as TomorrowIoResponse;

  const hourlyEntries = data.timelines?.hourly;

  if (!hourlyEntries?.length) {
    console.error('Tomorrow.io API: No hourly data in response');
    return null;
  }

  const dailyAggregations = aggregateDaily(hourlyEntries);
  const forecasts = dailyAggregations.slice(0, 5).map(buildForecast);

  return forecasts;
}
