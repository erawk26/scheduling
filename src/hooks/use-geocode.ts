import { useCallback } from 'react';
import { app } from '@/lib/offlinekit';
import { geocodeAddress } from '@/lib/graphhopper/geocode';
import type { Client, Appointment } from '@/lib/offlinekit/schema';

type WithMeta<T> = T & { _id: string; _deleted: boolean };

export function useGeocode() {
  const geocodeClient = useCallback(async (clientId: string, address: string) => {
    if (!address.trim()) return;
    const result = await geocodeAddress(address);
    if (!result) return;

    const all = await app.clients.findMany() as WithMeta<Client>[];
    const doc = all.find((d) => d.id === clientId && !d._deleted);
    if (!doc) return;

    await app.clients.update(doc._id, {
      latitude: result.lat,
      longitude: result.lon,
      updated_at: new Date().toISOString(),
    });
  }, []);

  const geocodeAppointment = useCallback(async (appointmentId: string, address: string) => {
    if (!address.trim()) return;
    const result = await geocodeAddress(address);
    if (!result) return;

    const all = await app.appointments.findMany() as WithMeta<Appointment>[];
    const doc = all.find((d) => d.id === appointmentId && !d._deleted);
    if (!doc) return;

    await app.appointments.update(doc._id, {
      latitude: result.lat,
      longitude: result.lon,
      updated_at: new Date().toISOString(),
    });
  }, []);

  const batchGeocodeClients = useCallback(async () => {
    const clients = await app.clients.findMany() as WithMeta<Client>[];
    const needsGeocode = clients.filter(
      (c) => !c._deleted && c.address && c.latitude == null
    );

    let geocoded = 0;
    let failed = 0;

    for (const client of needsGeocode) {
      if (!client.address) continue;
      const result = await geocodeAddress(client.address);
      if (result) {
        await app.clients.update(client._id, {
          latitude: result.lat,
          longitude: result.lon,
          updated_at: new Date().toISOString(),
        });
        geocoded++;
      } else {
        failed++;
      }
      await new Promise((r) => setTimeout(r, 1100));
    }

    return { geocoded, failed };
  }, []);

  return { geocodeClient, geocodeAppointment, batchGeocodeClients };
}
