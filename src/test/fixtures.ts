/**
 * Reusable test fixtures for integration tests.
 *
 * Provides canned API responses (OpenRouter streaming, weather, geocode)
 * and a helper to stamp documents with OfflineKit metadata.
 */

import type { WeatherForecast } from '@/lib/weather/types'

// ---------------------------------------------------------------------------
// OfflineKit document helper
// ---------------------------------------------------------------------------

/** Metadata fields added by OfflineKit to every persisted document. */
interface OfflineKitMeta {
  _id: string
  _collection: string
  _updatedAt: string
  _deleted: boolean
}

/**
 * Stamp a plain object with OfflineKit metadata so it looks like a real
 * persisted document.  All meta fields get sensible defaults that tests
 * can override via the `meta` parameter.
 *
 * @example
 * const client = withMeta('clients', { id: 'c-1', first_name: 'Jane', ... })
 */
export function withMeta<T extends Record<string, unknown>>(
  collection: string,
  doc: T,
  meta: Partial<OfflineKitMeta> = {},
): T & OfflineKitMeta {
  const id = (doc as Record<string, unknown>).id as string | undefined
  return {
    ...doc,
    _id: meta._id ?? id ?? crypto.randomUUID(),
    _collection: meta._collection ?? collection,
    _updatedAt: meta._updatedAt ?? new Date().toISOString(),
    _deleted: meta._deleted ?? false,
  }
}

// ---------------------------------------------------------------------------
// OpenRouter streaming response mock
// ---------------------------------------------------------------------------

/**
 * SSE frame format used by OpenRouter / OpenAI-compatible streaming.
 * Each delta is wrapped as `data: {...}\n\n` with a final `data: [DONE]`.
 */
function sseChunk(content: string): string {
  const payload = JSON.stringify({
    choices: [{ delta: { content } }],
  })
  return `data: ${payload}\n\n`
}

/**
 * Build a `ReadableStream<Uint8Array>` that emits OpenRouter-style SSE
 * chunks for each string in `parts`, then closes with `data: [DONE]`.
 *
 * Use this to mock `fetch` responses for the `/api/agent/chat` endpoint.
 *
 * @example
 * vi.spyOn(globalThis, 'fetch').mockResolvedValue(
 *   new Response(createStreamingResponse(['Hello', ' world', '!']), {
 *     headers: { 'Content-Type': 'text/event-stream' },
 *   }),
 * )
 */
export function createStreamingResponse(
  parts: string[] = ['Hello', ' world', '!'],
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const part of parts) {
        controller.enqueue(encoder.encode(sseChunk(part)))
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      controller.close()
    },
  })
}

/**
 * Return a `ReadableStreamDefaultReader`-like object whose `.read()` yields
 * pre-encoded text chunks then signals done.  Useful when tests need to mock
 * `response.body.getReader()` directly instead of a full `ReadableStream`.
 */
export function createMockStreamReader(
  parts: string[] = ['Hello', ' world', '!'],
): ReadableStreamDefaultReader<Uint8Array> {
  const encoder = new TextEncoder()
  const chunks = [
    ...parts.map((p) => encoder.encode(sseChunk(p))),
    encoder.encode('data: [DONE]\n\n'),
  ]
  let index = 0

  return {
    read() {
      if (index < chunks.length) {
        return Promise.resolve({ done: false, value: chunks[index++] } as ReadableStreamReadResult<Uint8Array>)
      }
      return Promise.resolve({ done: true, value: undefined } as ReadableStreamReadResult<Uint8Array>)
    },
    cancel() {
      return Promise.resolve()
    },
    releaseLock() {},
    closed: Promise.resolve(undefined),
  } as ReadableStreamDefaultReader<Uint8Array>
}

// ---------------------------------------------------------------------------
// Weather fixtures (Tomorrow.io format)
// ---------------------------------------------------------------------------

/** A single-day forecast matching `WeatherForecast` shape. */
export const cannedForecast: WeatherForecast = {
  date: '2026-03-29',
  temp_high_f: 72,
  temp_low_f: 55,
  temp_current_f: 65,
  feels_like_f: 63,
  humidity: 45,
  precip_probability: 10,
  wind_speed_mph: 8,
  wind_gust_mph: 14,
  weather_code: 1100,
  condition_label: 'Mostly Clear',
  condition_icon: 'Sun',
  is_outdoor_suitable: true,
  uv_index: 5,
}

/** Current conditions snapshot for a business location. */
export const cannedCurrent = {
  temperature: 65,
  temperatureApparent: 63,
  humidity: 45,
  precipitationProbability: 10,
  windSpeed: 8,
  windGust: 14,
  weatherCode: 1100,
  cloudCover: 20,
  uvIndex: 5,
  visibility: 10,
} as const

// ---------------------------------------------------------------------------
// Geocode fixtures (GraphHopper-style)
// ---------------------------------------------------------------------------

/** Single geocode result for "123 Main St, Anytown, TX". */
export const cannedGeocode = {
  lat: 32.7767,
  lon: -96.797,
  address: '123 Main St, Anytown, TX 75001',
  name: '123 Main St',
} as const

/** Multiple geocode results for a search query. */
export const cannedGeocodeMultiple = [
  {
    lat: 32.7767,
    lon: -96.797,
    address: '123 Main St, Anytown, TX 75001',
    name: '123 Main St',
  },
  {
    lat: 33.749,
    lon: -84.388,
    address: '456 Elm Ave, Atlanta, GA 30301',
    name: '456 Elm Ave',
  },
  {
    lat: 29.7604,
    lon: -95.3698,
    address: '789 Oak Blvd, Houston, TX 77001',
    name: '789 Oak Blvd',
  },
] as const
