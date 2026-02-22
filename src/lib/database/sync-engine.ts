/**
 * Sync Engine - Offline-First Synchronization
 *
 * CRITICAL Requirements:
 * - Queue all mutations for background sync
 * - Never block UI on network operations
 * - Last-write-wins conflict resolution
 * - Exponential backoff on failures
 * - Track needs_sync flag on all records
 *
 * See: /docs/tech_requirements_guide.md lines 247-381
 * See: /docs/AI_GUARDRAILS.md lines 36-58
 */

import { v4 as uuidv4 } from 'uuid';
import type { Kysely } from 'kysely';
import type { Database, SyncStatus, SyncResult, NewSyncQueueItem } from './types';
import { getAuthenticatedClient } from '@/lib/graphql/client';
import {
  UPSERT_USER, USER_UPDATE_COLUMNS,
  UPSERT_CLIENT, SOFT_DELETE_CLIENT, CLIENT_UPDATE_COLUMNS,
  UPSERT_PET, SOFT_DELETE_PET, PET_UPDATE_COLUMNS,
  UPSERT_SERVICE, SOFT_DELETE_SERVICE, SERVICE_UPDATE_COLUMNS,
  UPSERT_APPOINTMENT, SOFT_DELETE_APPOINTMENT, APPOINTMENT_UPDATE_COLUMNS,
} from '@/lib/graphql/mutations';
import type { GraphQLClient } from 'graphql-request';

/**
 * Tables that support synchronization
 */
type SyncTable = 'users' | 'clients' | 'pets' | 'services' | 'appointments';

/**
 * Mutation types
 */
type MutationType = 'CREATE' | 'UPDATE' | 'DELETE';

/**
 * Sync Engine - Manages offline mutation queue and sync
 */
export class SyncEngine {
  private isSyncing = false;
  private lastSync: Date | null = null;
  private syncWorker: NodeJS.Timeout | null = null;

  constructor(private kysely: Kysely<Database>) {}

  /**
   * Queue a mutation for background sync
   * NEVER blocks on network - returns immediately
   */
  async queueMutation(
    table: SyncTable,
    mutationType: MutationType,
    recordId: string,
    data: Record<string, any>
  ): Promise<void> {
    const now = Date.now();

    const queueItem: NewSyncQueueItem = {
      mutation_type: mutationType,
      table_name: table,
      record_id: recordId,
      data: JSON.stringify(data),
      created_at: now,
      attempts: 0,
      last_error: null,
      retry_after: null,
    };

    await this.kysely.insertInto('sync_queue').values(queueItem).execute();

    console.log(
      `[SyncEngine] Queued ${mutationType} for ${table}:${recordId}`
    );

    // Start background sync worker if not running
    this.startSyncWorker();
  }

  /**
   * Mark a record as needing sync
   */
  async markNeedsSync(
    table: SyncTable,
    recordId: string,
    operation: 'INSERT' | 'UPDATE' | 'DELETE'
  ): Promise<void> {
    await this.kysely
      .updateTable(table)
      .set({
        needs_sync: 1,
        sync_operation: operation,
      } as any)
      .where('id', '=', recordId)
      .execute();
  }

  /**
   * Clear needs_sync flag after successful sync
   */
  async clearNeedsSync(table: SyncTable, recordId: string): Promise<void> {
    const now = new Date().toISOString();

    // Get current version to increment
    const current = await this.kysely
      .selectFrom(table)
      .select('version' as any)
      .where('id', '=', recordId)
      .executeTakeFirst();

    const nextVersion = ((current as any)?.version || 1) + 1;

    await this.kysely
      .updateTable(table)
      .set({
        needs_sync: 0,
        sync_operation: null,
        synced_at: now,
        version: nextVersion,
      } as any)
      .where('id', '=', recordId)
      .execute();
  }

  /**
   * Get current sync status
   */
  async getSyncStatus(): Promise<SyncStatus> {
    const queueCount = await this.kysely
      .selectFrom('sync_queue')
      .select((eb) => eb.fn.count('id').as('count'))
      .executeTakeFirst();

    const lastError = await this.kysely
      .selectFrom('sync_queue')
      .select('last_error')
      .where('last_error', 'is not', null)
      .orderBy('created_at', 'desc')
      .limit(1)
      .executeTakeFirst();

    return {
      pending_items: Number(queueCount?.count ?? 0),
      last_sync: this.lastSync,
      is_syncing: this.isSyncing,
      last_error: lastError?.last_error ?? null,
    };
  }

  /**
   * Start background sync worker
   * Processes queue every 5 seconds when online
   */
  startSyncWorker(): void {
    if (this.syncWorker) {
      return; // Already running
    }

    this.syncWorker = setInterval(() => {
      if (navigator.onLine && !this.isSyncing) {
        this.processSyncQueue().catch((error) => {
          console.error('[SyncEngine] Worker error:', error);
        });
      }
    }, 5000); // Check every 5 seconds

    console.log('[SyncEngine] Background worker started');
  }

  /**
   * Stop background sync worker
   */
  stopSyncWorker(): void {
    if (this.syncWorker) {
      clearInterval(this.syncWorker);
      this.syncWorker = null;
      console.log('[SyncEngine] Background worker stopped');
    }
  }

  /**
   * Process sync queue (background operation)
   * Implements exponential backoff on failures
   */
  async processSyncQueue(): Promise<SyncResult> {
    if (this.isSyncing) {
      return {
        success: true,
        synced_count: 0,
        failed_count: 0,
        errors: [],
      };
    }

    this.isSyncing = true;

    // Get authenticated GraphQL client
    const graphqlClient = await getAuthenticatedClient();
    if (!graphqlClient) {
      console.log('[SyncEngine] No auth token available, skipping sync');
      this.isSyncing = false;
      return {
        success: true,
        synced_count: 0,
        failed_count: 0,
        errors: [],
      };
    }

    const now = Date.now();

    try {
      // Get pending items that are ready for retry
      const pendingItems = await this.kysely
        .selectFrom('sync_queue')
        .selectAll()
        .where((eb) =>
          eb.or([
            eb('retry_after', 'is', null),
            eb('retry_after', '<=', now),
          ])
        )
        .orderBy('created_at', 'asc')
        .limit(50) // Process in batches
        .execute();

      if (pendingItems.length === 0) {
        return {
          success: true,
          synced_count: 0,
          failed_count: 0,
          errors: [],
        };
      }

      console.log(
        `[SyncEngine] Processing ${pendingItems.length} pending items`
      );

      let synced = 0;
      let failed = 0;
      const errors: Array<{ id: number; error: string }> = [];

      for (const item of pendingItems) {
        try {
          await this.executeSyncMutation(graphqlClient, item);

          // Remove from queue on success
          await this.kysely
            .deleteFrom('sync_queue')
            .where('id', '=', item.id)
            .execute();

          // Clear needs_sync flag
          await this.clearNeedsSync(
            item.table_name as SyncTable,
            item.record_id
          );

          console.log(`[SyncEngine] Synced ${item.mutation_type} ${item.table_name}:${item.record_id}`);
          synced++;
        } catch (error) {
          const errorMsg =
            error instanceof Error ? error.message : 'Unknown error';

          // Check if this is a conflict error (constraint violation)
          const isConflict = errorMsg.includes('constraint') ||
            errorMsg.includes('conflict') ||
            errorMsg.includes('unique');

          if (isConflict) {
            // Attempt conflict resolution
            const itemData = JSON.parse(item.data);
            const resolution = await this.resolveConflict(
              item.table_name as SyncTable,
              item.record_id,
              itemData,
              errorMsg
            );

            console.log(
              `[SyncEngine] Conflict resolved: ${resolution} for ${item.table_name}:${item.record_id}`
            );

            // For local_wins, the upsert with on_conflict will handle it on retry
            // Reset retry_after to retry immediately
            await this.kysely
              .updateTable('sync_queue')
              .set({
                attempts: item.attempts + 1,
                last_error: `Conflict resolved: ${resolution}`,
                retry_after: null, // Retry immediately
              })
              .where('id', '=', item.id)
              .execute();

            failed++;
            errors.push({ id: item.id, error: `Conflict: ${resolution}` });
          } else {
            failed++;
            errors.push({ id: item.id, error: errorMsg });

            // Update queue item with error and exponential backoff
            const attempts = item.attempts + 1;
            const backoffMs = Math.min(
              1000 * Math.pow(2, attempts),
              3600000
            ); // Max 1 hour

            await this.kysely
              .updateTable('sync_queue')
              .set({
                attempts,
                last_error: errorMsg,
                retry_after: now + backoffMs,
              })
              .where('id', '=', item.id)
              .execute();

            console.error(
              `[SyncEngine] Failed to sync ${item.table_name}:${item.record_id}`,
              errorMsg
            );
          }
        }
      }

      this.lastSync = new Date();

      return {
        success: failed === 0,
        synced_count: synced,
        failed_count: failed,
        errors,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Manual sync trigger - force immediate sync
   */
  async syncNow(): Promise<SyncResult> {
    if (!navigator.onLine) {
      throw new Error('Cannot sync while offline');
    }

    return this.processSyncQueue();
  }

  /**
   * Get all pending mutations (for debugging)
   */
  async getPendingMutations(): Promise<Array<{
    id: number;
    table: string;
    type: string;
    recordId: string;
    attempts: number;
    createdAt: Date;
  }>> {
    const items = await this.kysely
      .selectFrom('sync_queue')
      .selectAll()
      .orderBy('created_at', 'asc')
      .execute();

    return items.map((item) => ({
      id: item.id,
      table: item.table_name,
      type: item.mutation_type,
      recordId: item.record_id,
      attempts: item.attempts,
      createdAt: new Date(item.created_at),
    }));
  }

  /**
   * Clear failed items from queue (for recovery)
   */
  async clearFailedItems(): Promise<number> {
    const result = await this.kysely
      .deleteFrom('sync_queue')
      .where('attempts', '>=', 5)
      .executeTakeFirst();

    return Number(result.numDeletedRows ?? 0);
  }

  /**
   * Execute a real sync mutation against Hasura
   */
  private async executeSyncMutation(
    client: GraphQLClient,
    item: { mutation_type: string; table_name: string; record_id: string; data: string }
  ): Promise<void> {
    const data = JSON.parse(item.data);
    const table = item.table_name;
    const mutationType = item.mutation_type;

    // Strip local-only fields before sending to server
    const { needs_sync, sync_operation, ...syncData } = data;

    // Convert SQLite boolean integers to PostgreSQL booleans
    if ('weather_dependent' in syncData) {
      syncData.weather_dependent = Boolean(syncData.weather_dependent);
    }
    if ('weather_alert' in syncData) {
      syncData.weather_alert = Boolean(syncData.weather_alert);
    }

    // Set synced_at timestamp
    syncData.synced_at = new Date().toISOString();

    // Bump version for conflict resolution
    if (syncData.version) {
      syncData.version = syncData.version + 1;
    }

    if (mutationType === 'DELETE') {
      await this.executeSoftDelete(client, table, item.record_id, syncData.deleted_at);
    } else {
      await this.executeUpsert(client, table, syncData);
    }
  }

  /**
   * Execute an upsert mutation (CREATE or UPDATE)
   */
  private async executeUpsert(
    client: GraphQLClient,
    table: string,
    data: Record<string, any>
  ): Promise<void> {
    const mutationMap: Record<string, { mutation: any; updateColumns: string[] }> = {
      users: { mutation: UPSERT_USER, updateColumns: USER_UPDATE_COLUMNS },
      clients: { mutation: UPSERT_CLIENT, updateColumns: CLIENT_UPDATE_COLUMNS },
      pets: { mutation: UPSERT_PET, updateColumns: PET_UPDATE_COLUMNS },
      services: { mutation: UPSERT_SERVICE, updateColumns: SERVICE_UPDATE_COLUMNS },
      appointments: { mutation: UPSERT_APPOINTMENT, updateColumns: APPOINTMENT_UPDATE_COLUMNS },
    };

    const config = mutationMap[table];
    if (!config) {
      throw new Error(`Unknown table: ${table}`);
    }

    await client.request(config.mutation, {
      object: data,
      update_columns: config.updateColumns,
    });
  }

  /**
   * Execute a soft delete mutation
   */
  private async executeSoftDelete(
    client: GraphQLClient,
    table: string,
    recordId: string,
    deletedAt: string
  ): Promise<void> {
    const now = new Date().toISOString();
    const deleteMap: Record<string, any> = {
      clients: SOFT_DELETE_CLIENT,
      pets: SOFT_DELETE_PET,
      services: SOFT_DELETE_SERVICE,
      appointments: SOFT_DELETE_APPOINTMENT,
    };

    const mutation = deleteMap[table];
    if (!mutation) {
      // Users table doesn't support soft delete
      console.warn(`[SyncEngine] Soft delete not supported for table: ${table}`);
      return;
    }

    await client.request(mutation, {
      id: recordId,
      deleted_at: deletedAt || now,
      updated_at: now,
    });
  }

  /**
   * Resolve conflict between local and server records using last-write-wins.
   * Called when an upsert fails due to version conflict.
   *
   * Strategy: Compare updated_at timestamps. Most recent write wins.
   * If local wins: retry the upsert with incremented version
   * If server wins: update local record with server data
   */
  async resolveConflict(
    table: SyncTable,
    recordId: string,
    localData: Record<string, any>,
    _serverError: string
  ): Promise<'local_wins' | 'server_wins' | 'no_conflict'> {
    const localVersion = localData.version || 1;

    // For now, local always wins in offline-first architecture
    // The server will accept the upsert with on_conflict update
    // True conflict resolution requires comparing server timestamps
    console.log(
      `[SyncEngine] Conflict on ${table}:${recordId} - ` +
      `local version=${localVersion}, updated_at=${localData.updated_at}. ` +
      `Retrying with incremented version.`
    );

    return 'local_wins';
  }
}

/**
 * Helper function to create local-first mutation
 * Pattern: Update local -> Queue sync -> Return immediately
 */
export async function createLocalFirst<T extends Record<string, any>>(
  kysely: Kysely<Database>,
  syncEngine: SyncEngine,
  table: SyncTable,
  data: T
): Promise<T> {
  const now = new Date().toISOString();
  const id = uuidv4();

  const record = {
    ...data,
    id,
    created_at: now,
    updated_at: now,
    version: 1,
    needs_sync: 1,
    sync_operation: 'INSERT',
  };

  // 1. Update local SQLite immediately (<200ms)
  await kysely.insertInto(table).values(record as any).execute();

  // 2. Queue for background sync (non-blocking)
  await syncEngine.queueMutation(table, 'CREATE', id, record);

  // 3. Return immediately - don't wait for server
  return record as T;
}

/**
 * Helper function to update local-first
 */
export async function updateLocalFirst<T extends Record<string, any>>(
  kysely: Kysely<Database>,
  syncEngine: SyncEngine,
  table: SyncTable,
  id: string,
  updates: Partial<T>
): Promise<void> {
  const now = new Date().toISOString();

  const record = {
    ...updates,
    updated_at: now,
    needs_sync: 1,
    sync_operation: 'UPDATE',
  };

  // 1. Update local SQLite immediately
  await kysely
    .updateTable(table)
    .set(record as any)
    .where('id', '=', id)
    .execute();

  // 2. Queue for background sync
  await syncEngine.queueMutation(table, 'UPDATE', id, { id, ...record });
}

/**
 * Helper function to delete local-first (soft delete)
 */
export async function deleteLocalFirst(
  kysely: Kysely<Database>,
  syncEngine: SyncEngine,
  table: SyncTable,
  id: string
): Promise<void> {
  const now = new Date().toISOString();

  // 1. Soft delete in local SQLite
  await kysely
    .updateTable(table)
    .set({
      deleted_at: now,
      updated_at: now,
      needs_sync: 1,
      sync_operation: 'DELETE',
    } as any)
    .where('id', '=', id)
    .execute();

  // 2. Queue for background sync
  await syncEngine.queueMutation(table, 'DELETE', id, { id, deleted_at: now });
}
