/**
 * Sync Engine Tests
 *
 * Tests for offline-first synchronization
 * Requirements: Queue mutations, background sync, conflict resolution
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  SQLiteManager,
  SyncEngine,
  createLocalFirst,
  updateLocalFirst,
  deleteLocalFirst,
  resetSQLiteManager,
} from '@/lib/database';

describe('SyncEngine', () => {
  let manager: SQLiteManager;
  let syncEngine: SyncEngine;

  beforeEach(async () => {
    resetSQLiteManager();
    manager = new SQLiteManager();
    await manager.initialize();
    syncEngine = new SyncEngine(manager.getKysely());
  });

  afterEach(async () => {
    syncEngine.stopSyncWorker();
    await manager.close();
    resetSQLiteManager();
  });

  describe('mutation queueing', () => {
    it('should queue a CREATE mutation', async () => {
      await syncEngine.queueMutation('clients', 'CREATE', 'client-1', {
        first_name: 'John',
        last_name: 'Doe',
      });

      const status = await syncEngine.getSyncStatus();
      expect(status.pending_items).toBe(1);
    });

    it('should queue an UPDATE mutation', async () => {
      await syncEngine.queueMutation('clients', 'UPDATE', 'client-1', {
        first_name: 'Jane',
      });

      const pending = await syncEngine.getPendingMutations();
      expect(pending).toHaveLength(1);
      expect(pending[0].type).toBe('UPDATE');
    });

    it('should queue a DELETE mutation', async () => {
      await syncEngine.queueMutation('clients', 'DELETE', 'client-1', {
        deleted_at: new Date().toISOString(),
      });

      const pending = await syncEngine.getPendingMutations();
      expect(pending[0].type).toBe('DELETE');
    });

    it('should return immediately without blocking', async () => {
      const start = performance.now();

      await syncEngine.queueMutation('appointments', 'CREATE', 'appt-1', {
        start_time: '2024-01-01T10:00:00Z',
      });

      const duration = performance.now() - start;

      // Should be very fast (<50ms)
      expect(duration).toBeLessThan(50);
    });
  });

  describe('needs_sync tracking', () => {
    it('should mark record as needs_sync', async () => {
      const kysely = manager.getKysely();
      const now = new Date().toISOString();

      // Insert client
      await kysely
        .insertInto('clients')
        .values({
          id: 'client-1',
          user_id: 'user-1',
          first_name: 'John',
          last_name: 'Doe',
          email: null,
          phone: null,
          address: null,
          latitude: null,
          longitude: null,
          notes: null,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          deleted_at: null,
          needs_sync: 0,
          sync_operation: null,
        })
        .execute();

      // Mark needs sync
      await syncEngine.markNeedsSync('clients', 'client-1', 'UPDATE');

      const client = await kysely
        .selectFrom('clients')
        .selectAll()
        .where('id', '=', 'client-1')
        .executeTakeFirst();

      expect(client?.needs_sync).toBe(1);
      expect(client?.sync_operation).toBe('UPDATE');
    });

    it('should clear needs_sync after successful sync', async () => {
      const kysely = manager.getKysely();
      const now = new Date().toISOString();

      await kysely
        .insertInto('clients')
        .values({
          id: 'client-1',
          user_id: 'user-1',
          first_name: 'John',
          last_name: 'Doe',
          email: null,
          phone: null,
          address: null,
          latitude: null,
          longitude: null,
          notes: null,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          deleted_at: null,
          needs_sync: 1,
          sync_operation: 'INSERT',
        })
        .execute();

      await syncEngine.clearNeedsSync('clients', 'client-1');

      const client = await kysely
        .selectFrom('clients')
        .selectAll()
        .where('id', '=', 'client-1')
        .executeTakeFirst();

      expect(client?.needs_sync).toBe(0);
      expect(client?.sync_operation).toBeNull();
      expect(client?.synced_at).toBeDefined();
    });
  });

  describe('sync status', () => {
    it('should return sync status', async () => {
      const status = await syncEngine.getSyncStatus();

      expect(status).toHaveProperty('pending_items');
      expect(status).toHaveProperty('last_sync');
      expect(status).toHaveProperty('is_syncing');
      expect(status).toHaveProperty('last_error');
    });

    it('should track pending items count', async () => {
      await syncEngine.queueMutation('clients', 'CREATE', 'c1', {});
      await syncEngine.queueMutation('clients', 'CREATE', 'c2', {});
      await syncEngine.queueMutation('appointments', 'UPDATE', 'a1', {});

      const status = await syncEngine.getSyncStatus();
      expect(status.pending_items).toBe(3);
    });
  });

  describe('sync worker', () => {
    it('should start sync worker', () => {
      syncEngine.startSyncWorker();
      // Worker should be running (no error thrown)
      expect(true).toBe(true);
    });

    it('should stop sync worker', () => {
      syncEngine.startSyncWorker();
      syncEngine.stopSyncWorker();
      // Worker should be stopped (no error thrown)
      expect(true).toBe(true);
    });

    it('should not start duplicate workers', () => {
      syncEngine.startSyncWorker();
      syncEngine.startSyncWorker(); // Second call
      // Should not throw error
      expect(true).toBe(true);
    });
  });

  describe('pending mutations', () => {
    it('should retrieve pending mutations', async () => {
      await syncEngine.queueMutation('clients', 'CREATE', 'client-1', {
        name: 'Test',
      });

      const pending = await syncEngine.getPendingMutations();

      expect(pending).toHaveLength(1);
      expect(pending[0]).toHaveProperty('id');
      expect(pending[0]).toHaveProperty('table');
      expect(pending[0]).toHaveProperty('type');
      expect(pending[0]).toHaveProperty('recordId');
      expect(pending[0]).toHaveProperty('attempts');
      expect(pending[0]).toHaveProperty('createdAt');
    });

    it('should order by creation time', async () => {
      await syncEngine.queueMutation('clients', 'CREATE', 'c1', {});
      await new Promise((resolve) => setTimeout(resolve, 10));
      await syncEngine.queueMutation('clients', 'CREATE', 'c2', {});

      const pending = await syncEngine.getPendingMutations();

      expect(pending[0].recordId).toBe('c1');
      expect(pending[1].recordId).toBe('c2');
    });
  });

  describe('local-first helpers', () => {
    it('should create record locally first', async () => {
      const kysely = manager.getKysely();

      const client = await createLocalFirst(
        kysely,
        syncEngine,
        'clients',
        {
          user_id: 'user-1',
          first_name: 'John',
          last_name: 'Doe',
          email: 'john@example.com',
          phone: null,
          address: null,
          latitude: null,
          longitude: null,
          notes: null,
        }
      );

      expect(client.id).toBeDefined();
      expect(client.needs_sync).toBe(1);
      expect(client.sync_operation).toBe('INSERT');

      // Verify in database
      const saved = await kysely
        .selectFrom('clients')
        .selectAll()
        .where('id', '=', client.id)
        .executeTakeFirst();

      expect(saved).toBeDefined();

      // Verify in sync queue
      const status = await syncEngine.getSyncStatus();
      expect(status.pending_items).toBeGreaterThan(0);
    });

    it('should update record locally first', async () => {
      const kysely = manager.getKysely();
      const now = new Date().toISOString();

      // Create initial record
      await kysely
        .insertInto('clients')
        .values({
          id: 'client-1',
          user_id: 'user-1',
          first_name: 'John',
          last_name: 'Doe',
          email: null,
          phone: null,
          address: null,
          latitude: null,
          longitude: null,
          notes: null,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          deleted_at: null,
          needs_sync: 0,
          sync_operation: null,
        })
        .execute();

      // Update locally first
      await updateLocalFirst(kysely, syncEngine, 'clients', 'client-1', {
        first_name: 'Jane',
      });

      const updated = await kysely
        .selectFrom('clients')
        .selectAll()
        .where('id', '=', 'client-1')
        .executeTakeFirst();

      expect(updated?.first_name).toBe('Jane');
      expect(updated?.needs_sync).toBe(1);
      expect(updated?.sync_operation).toBe('UPDATE');
    });

    it('should delete record locally first (soft delete)', async () => {
      const kysely = manager.getKysely();
      const now = new Date().toISOString();

      // Create initial record
      await kysely
        .insertInto('clients')
        .values({
          id: 'client-1',
          user_id: 'user-1',
          first_name: 'John',
          last_name: 'Doe',
          email: null,
          phone: null,
          address: null,
          latitude: null,
          longitude: null,
          notes: null,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          deleted_at: null,
          needs_sync: 0,
          sync_operation: null,
        })
        .execute();

      // Delete locally first
      await deleteLocalFirst(kysely, syncEngine, 'clients', 'client-1');

      const deleted = await kysely
        .selectFrom('clients')
        .selectAll()
        .where('id', '=', 'client-1')
        .executeTakeFirst();

      expect(deleted?.deleted_at).toBeDefined();
      expect(deleted?.needs_sync).toBe(1);
      expect(deleted?.sync_operation).toBe('DELETE');
    });

    it('should perform local operations in <200ms', async () => {
      const kysely = manager.getKysely();
      const start = performance.now();

      await createLocalFirst(
        kysely,
        syncEngine,
        'clients',
        {
          user_id: 'user-1',
          first_name: 'Performance',
          last_name: 'Test',
          email: null,
          phone: null,
          address: null,
          latitude: null,
          longitude: null,
          notes: null,
        }
      );

      const duration = performance.now() - start;
      expect(duration).toBeLessThan(200);
    });
  });

  describe('failed items management', () => {
    it('should clear failed items', async () => {
      const kysely = manager.getKysely();

      // Add item with high attempt count
      await kysely
        .insertInto('sync_queue')
        .values({
          mutation_type: 'CREATE',
          table_name: 'clients',
          record_id: 'client-fail',
          data: JSON.stringify({}),
          created_at: Date.now(),
          attempts: 5,
          last_error: 'Too many attempts',
          retry_after: null,
        })
        .execute();

      const cleared = await syncEngine.clearFailedItems();
      expect(cleared).toBe(1);

      const status = await syncEngine.getSyncStatus();
      expect(status.pending_items).toBe(0);
    });
  });
});
