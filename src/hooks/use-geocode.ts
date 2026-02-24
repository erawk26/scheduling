'use client';

import { useCallback } from 'react';
import { useDatabase } from '@/providers/database-provider';
import { geocodeAddress } from '@/lib/graphhopper/geocode';

/**
 * Hook that provides functions to geocode and update a record's coordinates.
 * Works for both clients and appointments tables.
 */
export function useGeocode() {
  const { db } = useDatabase();

  const geocodeClient = useCallback(async (clientId: string, address: string) => {
    if (!db || !address.trim()) return;

    const result = await geocodeAddress(address);
    if (!result) return;

    await db.updateTable('clients')
      .set({
        latitude: result.lat,
        longitude: result.lon,
        updated_at: new Date().toISOString().slice(0, 19),
      })
      .where('id', '=', clientId)
      .execute();
  }, [db]);

  const geocodeAppointment = useCallback(async (appointmentId: string, address: string) => {
    if (!db || !address.trim()) return;

    const result = await geocodeAddress(address);
    if (!result) return;

    await db.updateTable('appointments')
      .set({
        latitude: result.lat,
        longitude: result.lon,
        updated_at: new Date().toISOString().slice(0, 19),
      })
      .where('id', '=', appointmentId)
      .execute();
  }, [db]);

  const batchGeocodeClients = useCallback(async () => {
    if (!db) return { geocoded: 0, failed: 0 };

    // Find clients with address but no coordinates
    const clients = await db.selectFrom('clients')
      .select(['id', 'address'])
      .where('address', 'is not', null)
      .where('latitude', 'is', null)
      .where('deleted_at', 'is', null)
      .execute();

    let geocoded = 0;
    let failed = 0;

    for (const client of clients) {
      if (!client.address) continue;
      const result = await geocodeAddress(client.address);
      if (result) {
        await db.updateTable('clients')
          .set({
            latitude: result.lat,
            longitude: result.lon,
            updated_at: new Date().toISOString().slice(0, 19),
          })
          .where('id', '=', client.id)
          .execute();
        geocoded++;
      } else {
        failed++;
      }
      // Small delay between requests to respect rate limits
      await new Promise(r => setTimeout(r, 1100));
    }

    return { geocoded, failed };
  }, [db]);

  return { geocodeClient, geocodeAppointment, batchGeocodeClients };
}
