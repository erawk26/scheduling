/**
 * Weather Types - Tomorrow.io API Integration
 *
 * Types for weather forecasts, condition codes, and outdoor suitability.
 * See: /docs/tech_requirements_guide.md lines 1032-1171
 */

// ============================================================================
// Tomorrow.io API Response Types
// ============================================================================

export interface TomorrowIoValues {
  temperature: number;
  temperatureApparent: number;
  humidity: number;
  precipitationProbability: number;
  windSpeed: number;
  windGust: number;
  weatherCode: number;
  cloudCover: number;
  uvIndex: number;
  visibility: number;
}

export interface TomorrowIoHourlyEntry {
  time: string;
  values: TomorrowIoValues;
}

export interface TomorrowIoResponse {
  timelines: {
    hourly: TomorrowIoHourlyEntry[];
    daily?: Array<{ time: string; values: Record<string, number> }>;
    minutely?: Array<{ time: string; values: Record<string, number> }>;
  };
  location: { lat: number; lon: number };
}

// ============================================================================
// App Forecast Types
// ============================================================================

export interface WeatherForecast {
  date: string;
  temp_high_f: number;
  temp_low_f: number;
  temp_current_f: number;
  feels_like_f: number;
  humidity: number;
  precip_probability: number;
  wind_speed_mph: number;
  wind_gust_mph: number;
  weather_code: number;
  condition_label: string;
  condition_icon: string;
  is_outdoor_suitable: boolean;
  uv_index: number;
}

export interface WeatherResponse {
  forecasts: WeatherForecast[];
  location: { lat: number; lon: number };
}

// ============================================================================
// Weather Code Mapping
// ============================================================================

export const WEATHER_CODES: Record<number, { label: string; icon: string }> = {
  1000: { label: 'Clear', icon: 'Sun' },
  1001: { label: 'Cloudy', icon: 'Cloud' },
  1100: { label: 'Mostly Clear', icon: 'Sun' },
  1101: { label: 'Partly Cloudy', icon: 'CloudSun' },
  1102: { label: 'Mostly Cloudy', icon: 'Cloud' },
  2000: { label: 'Fog', icon: 'CloudFog' },
  4000: { label: 'Drizzle', icon: 'CloudDrizzle' },
  4001: { label: 'Rain', icon: 'CloudRain' },
  4200: { label: 'Light Rain', icon: 'CloudDrizzle' },
  4201: { label: 'Heavy Rain', icon: 'CloudRain' },
  5000: { label: 'Snow', icon: 'Snowflake' },
  5001: { label: 'Flurries', icon: 'Snowflake' },
  5100: { label: 'Light Snow', icon: 'Snowflake' },
  5101: { label: 'Heavy Snow', icon: 'Snowflake' },
  6000: { label: 'Freezing Drizzle', icon: 'CloudDrizzle' },
  6001: { label: 'Freezing Rain', icon: 'CloudRain' },
  6200: { label: 'Light Freezing Rain', icon: 'CloudDrizzle' },
  6201: { label: 'Heavy Freezing Rain', icon: 'CloudRain' },
  7000: { label: 'Ice Pellets', icon: 'CloudHail' },
  7101: { label: 'Heavy Ice Pellets', icon: 'CloudHail' },
  7102: { label: 'Light Ice Pellets', icon: 'CloudHail' },
  8000: { label: 'Thunderstorm', icon: 'CloudLightning' },
};

/**
 * Determine if weather conditions are suitable for outdoor services.
 * Per tech spec: precip < 40%, wind < 20mph, temp 32-95F
 */
export function isOutdoorSuitable(
  precipProbability: number,
  windSpeed: number,
  temperature: number
): boolean {
  return (
    precipProbability < 40 &&
    windSpeed < 20 &&
    temperature >= 32 &&
    temperature <= 95
  );
}
