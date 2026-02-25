/**
 * Initial Data Pull Hook
 *
 * On first authenticated login (no local data for this user),
 * pulls all user data from Hasura into local SQLite.
 */

'use client';

import { useState, useEffect, useRef } from 'react';
import { useDatabase } from '@/providers/database-provider';
import { useAuth } from '@/providers/auth-provider';
import { getAuthenticatedClient } from '@/lib/graphql/client';
import { PULL_ALL_USER_DATA } from '@/lib/graphql/queries';
import type { PullAllUserDataResponse } from '@/lib/graphql/queries';
import { useQueryClient } from '@tanstack/react-query';

interface InitialPullState {
  isPulling: boolean;
  progress: string;
  error: string | null;
  completed: boolean;
}

/**
 * Creates a default local user row for new users who have no server data yet,
 * or when the server pull fails. Uses onConflict doNothing so it's safe to call
 * multiple times.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureLocalUser(db: any, userId: string): Promise<void> {
  await db
    .insertInto('users')
    .values({
      id: userId,
      business_name: null,
      phone: null,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/New_York',
      service_area_miles: 25,
      business_latitude: null,
      business_longitude: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      version: 1,
      synced_at: null,
      needs_sync: 1,
      sync_operation: 'INSERT',
    } as any)
    .onConflict((oc: any) => oc.column('id').doNothing())
    .execute();
}

/**
 * Hook that checks if local data exists for the authenticated user.
 * If not, pulls all data from Hasura and populates local SQLite.
 */
export function useInitialDataPull(): InitialPullState {
  const { db, isReady } = useDatabase();
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [state, setState] = useState<InitialPullState>({
    isPulling: false,
    progress: '',
    error: null,
    completed: false,
  });
  const hasChecked = useRef(false);

  useEffect(() => {
    // Only run once when both DB and auth are ready
    if (!isReady || !db || !session?.user?.id || hasChecked.current) return;
    hasChecked.current = true;

    const userId = session.user.id;

    async function checkAndPull() {
      try {
        // Check if we already have local data for this user
        const existingUser = await db!
          .selectFrom('users')
          .select('id')
          .where('id', '=', userId)
          .executeTakeFirst();

        if (existingUser) {
          // Data already exists locally, no pull needed
          setState(prev => ({ ...prev, completed: true }));
          return;
        }

        // Check if we have data from the 'local-user' temp ID that needs migration
        const localUserData = await db!
          .selectFrom('clients')
          .select('id')
          .where('user_id', '=', 'local-user')
          .limit(1)
          .executeTakeFirst();

        if (localUserData) {
          setState(prev => ({ ...prev, isPulling: true, progress: 'Migrating local data to your account...' }));

          let migratedCount = 0;

          // Migrate clients
          const clientResult = await db!
            .updateTable('clients')
            .set({ user_id: userId, needs_sync: 1, sync_operation: 'UPDATE' } as any)
            .where('user_id', '=', 'local-user')
            .executeTakeFirst();
          migratedCount += Number(clientResult.numUpdatedRows ?? 0);

          // Migrate services
          const serviceResult = await db!
            .updateTable('services')
            .set({ user_id: userId, needs_sync: 1, sync_operation: 'UPDATE' } as any)
            .where('user_id', '=', 'local-user')
            .executeTakeFirst();
          migratedCount += Number(serviceResult.numUpdatedRows ?? 0);

          // Migrate appointments
          const appointmentResult = await db!
            .updateTable('appointments')
            .set({ user_id: userId, needs_sync: 1, sync_operation: 'UPDATE' } as any)
            .where('user_id', '=', 'local-user')
            .executeTakeFirst();
          migratedCount += Number(appointmentResult.numUpdatedRows ?? 0);

          // Remove the local-user placeholder from users table
          await db!
            .deleteFrom('users')
            .where('id', '=', 'local-user')
            .execute();

          // Invalidate queries so UI reflects the migration
          await queryClient.invalidateQueries();

          console.log(`[InitialDataPull] Migrated ${migratedCount} records from local-user to ${userId}`);

          setState({
            isPulling: false,
            progress: `Migrated ${migratedCount} records to your account`,
            error: null,
            completed: true,
          });
          return;
        }

        // Check if we're online
        if (!navigator.onLine) {
          // Offline on first login - work with empty state
          setState(prev => ({
            ...prev,
            completed: true,
            progress: 'Offline - data will sync when online',
          }));
          return;
        }

        // Start the pull
        setState(prev => ({ ...prev, isPulling: true, progress: 'Connecting to server...' }));

        const client = await getAuthenticatedClient();
        if (!client) {
          // No auth token available - might be unauthenticated
          setState(prev => ({
            ...prev,
            isPulling: false,
            completed: true,
            progress: 'No server connection available',
          }));
          return;
        }

        setState(prev => ({ ...prev, progress: 'Downloading your data...' }));

        const data = await client.request<PullAllUserDataResponse>(PULL_ALL_USER_DATA);

        // Insert user profile
        if (data.users.length > 0) {
          setState(prev => ({ ...prev, progress: 'Setting up profile...' }));
          const user = data.users[0]!;
          await db!
            .insertInto('users')
            .values({
              id: user.id,
              business_name: user.business_name,
              phone: user.phone,
              timezone: user.timezone,
              service_area_miles: user.service_area_miles,
              business_latitude: user.business_latitude,
              business_longitude: user.business_longitude,
              created_at: user.created_at,
              updated_at: user.updated_at,
              version: user.version,
              synced_at: user.synced_at || new Date().toISOString(),
              needs_sync: 0,
              sync_operation: null,
            })
            .onConflict((oc) => oc.column('id').doNothing())
            .execute();
        } else {
          // New user with no server data yet - create default local profile
          setState(prev => ({ ...prev, progress: 'Setting up profile...' }));
          await ensureLocalUser(db!, userId);
        }

        // Insert clients
        if (data.clients.length > 0) {
          setState(prev => ({ ...prev, progress: `Importing ${data.clients.length} clients...` }));
          for (const c of data.clients) {
            await db!
              .insertInto('clients')
              .values({
                id: c.id,
                user_id: c.user_id,
                first_name: c.first_name,
                last_name: c.last_name,
                email: c.email,
                phone: c.phone,
                address: c.address,
                latitude: c.latitude,
                longitude: c.longitude,
                notes: c.notes,
                scheduling_flexibility: (c.scheduling_flexibility ?? 'unknown') as 'unknown' | 'flexible' | 'fixed',
                created_at: c.created_at,
                updated_at: c.updated_at,
                version: c.version,
                synced_at: c.synced_at || new Date().toISOString(),
                deleted_at: c.deleted_at,
                needs_sync: 0,
                sync_operation: null,
              })
              .onConflict((oc) => oc.column('id').doNothing())
              .execute();
          }
        }

        // Insert pets
        if (data.pets.length > 0) {
          setState(prev => ({ ...prev, progress: `Importing ${data.pets.length} pets...` }));
          for (const p of data.pets) {
            await db!
              .insertInto('pets')
              .values({
                id: p.id,
                client_id: p.client_id,
                name: p.name,
                species: p.species,
                breed: p.breed,
                size: p.size,
                age_years: p.age_years,
                weight_lbs: p.weight_lbs,
                behavior_notes: p.behavior_notes,
                medical_notes: p.medical_notes,
                created_at: p.created_at,
                updated_at: p.updated_at,
                version: p.version,
                synced_at: p.synced_at || new Date().toISOString(),
                deleted_at: p.deleted_at,
                needs_sync: 0,
                sync_operation: null,
              })
              .onConflict((oc) => oc.column('id').doNothing())
              .execute();
          }
        }

        // Insert services (convert boolean → integer for SQLite)
        if (data.services.length > 0) {
          setState(prev => ({ ...prev, progress: `Importing ${data.services.length} services...` }));
          for (const s of data.services) {
            await db!
              .insertInto('services')
              .values({
                id: s.id,
                user_id: s.user_id,
                name: s.name,
                description: s.description,
                duration_minutes: s.duration_minutes,
                price_cents: s.price_cents,
                weather_dependent: s.weather_dependent ? 1 : 0,
                location_type: s.location_type,
                created_at: s.created_at,
                updated_at: s.updated_at,
                version: s.version,
                synced_at: s.synced_at || new Date().toISOString(),
                deleted_at: s.deleted_at,
                needs_sync: 0,
                sync_operation: null,
              })
              .onConflict((oc) => oc.column('id').doNothing())
              .execute();
          }
        }

        // Insert appointments (convert boolean → integer for SQLite)
        if (data.appointments.length > 0) {
          setState(prev => ({ ...prev, progress: `Importing ${data.appointments.length} appointments...` }));
          for (const a of data.appointments) {
            await db!
              .insertInto('appointments')
              .values({
                id: a.id,
                user_id: a.user_id,
                client_id: a.client_id,
                pet_id: a.pet_id,
                service_id: a.service_id,
                start_time: a.start_time,
                end_time: a.end_time,
                status: a.status as any,
                location_type: a.location_type,
                address: a.address,
                latitude: a.latitude,
                longitude: a.longitude,
                notes: a.notes,
                internal_notes: a.internal_notes,
                weather_alert: a.weather_alert ? 1 : 0,
                created_at: a.created_at,
                updated_at: a.updated_at,
                version: a.version,
                synced_at: a.synced_at || new Date().toISOString(),
                deleted_at: a.deleted_at,
                needs_sync: 0,
                sync_operation: null,
              })
              .onConflict((oc) => oc.column('id').doNothing())
              .execute();
          }
        }

        // Invalidate all queries so UI refreshes with pulled data
        await queryClient.invalidateQueries();

        const totalRecords =
          data.users.length +
          data.clients.length +
          data.pets.length +
          data.services.length +
          data.appointments.length;

        setState({
          isPulling: false,
          progress: `Imported ${totalRecords} records`,
          error: null,
          completed: true,
        });

        console.log(`[InitialDataPull] Completed: ${totalRecords} records imported`);
      } catch (err) {
        console.error('[InitialDataPull] Failed:', err);

        // Even if pull fails, ensure user has a local profile so app is usable
        try {
          await ensureLocalUser(db!, userId);
        } catch {
          // Ignore - best effort
        }

        setState({
          isPulling: false,
          progress: '',
          error: err instanceof Error ? err.message : 'Failed to pull data',
          completed: true,
        });
      }
    }

    checkAndPull();
  }, [isReady, db, session?.user?.id, queryClient]);

  return state;
}
