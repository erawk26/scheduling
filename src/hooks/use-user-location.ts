/**
 * User Location Hook - Browser Geolocation with localStorage Cache
 *
 * Provides the user's coordinates for weather lookups.
 * Auto-detects on first load, caches in localStorage.
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

const LOCATION_CACHE_KEY = 'ke-agenda-weather-location';

function getCachedLocation(): { lat: number; lon: number } | null {
  try {
    const cached = localStorage.getItem(LOCATION_CACHE_KEY);
    return cached ? JSON.parse(cached) : null;
  } catch {
    return null;
  }
}

function cacheLocation(lat: number, lon: number): void {
  try {
    localStorage.setItem(LOCATION_CACHE_KEY, JSON.stringify({ lat, lon }));
  } catch {
    // localStorage unavailable
  }
}

export type GeoStatus = 'idle' | 'loading' | 'granted' | 'denied';

export function useUserLocation() {
  const cached = typeof window !== 'undefined' ? getCachedLocation() : null;
  const [lat, setLat] = useState<number | null>(cached?.lat ?? null);
  const [lon, setLon] = useState<number | null>(cached?.lon ?? null);
  const [status, setStatus] = useState<GeoStatus>('idle');

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('denied');
      return;
    }
    setStatus('loading');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const newLat = Math.round(pos.coords.latitude * 100) / 100;
        const newLon = Math.round(pos.coords.longitude * 100) / 100;
        setLat(newLat);
        setLon(newLon);
        cacheLocation(newLat, newLon);
        setStatus('granted');
      },
      () => {
        setStatus('denied');
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, []);

  // Auto-detect on first load if no cached location
  useEffect(() => {
    if (lat === null && lon === null) {
      requestLocation();
    }
  }, [lat, lon, requestLocation]);

  return { lat, lon, status, requestLocation };
}
