/**
 * SQLite Manager Tests
 *
 * Tests for local-first database operations
 * Requirements: <200ms operations, offline support, transaction safety
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SQLiteManager, getSQLiteManager, resetSQLiteManager } from '@/lib/database';

describe('SQLiteManager', () => {
  let manager: SQLiteManager;

  beforeEach(async () => {
    resetSQLiteManager();
    manager = getSQLiteManager();
    await manager.initialize();
  });

  afterEach(async () => {
    await manager.close();
    resetSQLiteManager();
  });

  describe('initialization', () => {
    it('should initialize successfully', () => {
      expect(manager.isReady()).toBe(true);
    });

    it('should not reinitialize if already initialized', async () => {
      await manager.initialize(); // Second call
      expect(manager.isReady()).toBe(true);
    });

    it('should provide Kysely instance', () => {
      const kysely = manager.getKysely();
      expect(kysely).toBeDefined();
    });

    it('should provide raw database', () => {
      const db = manager.getRawDb();
      expect(db).toBeDefined();
    });
  });

  describe('CRUD operations', () => {
    it('should insert a user record', async () => {
      const kysely = manager.getKysely();
      const now = new Date().toISOString();

      await kysely
        .insertInto('users')
        .values({
          id: 'user-1',
          business_name: 'Test Business',
          phone: '555-1234',
          timezone: 'America/New_York',
          service_area_miles: 25,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          needs_sync: 0,
          sync_operation: null,
        })
        .execute();

      const user = await kysely
        .selectFrom('users')
        .selectAll()
        .where('id', '=', 'user-1')
        .executeTakeFirst();

      expect(user).toBeDefined();
      expect(user?.business_name).toBe('Test Business');
    });

    it('should update a user record', async () => {
      const kysely = manager.getKysely();
      const now = new Date().toISOString();

      // Insert
      await kysely
        .insertInto('users')
        .values({
          id: 'user-1',
          business_name: 'Test Business',
          phone: '555-1234',
          timezone: 'America/New_York',
          service_area_miles: 25,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          needs_sync: 0,
          sync_operation: null,
        })
        .execute();

      // Update
      await kysely
        .updateTable('users')
        .set({
          business_name: 'Updated Business',
          updated_at: now,
        })
        .where('id', '=', 'user-1')
        .execute();

      const user = await kysely
        .selectFrom('users')
        .selectAll()
        .where('id', '=', 'user-1')
        .executeTakeFirst();

      expect(user?.business_name).toBe('Updated Business');
    });

    it('should delete a record (soft delete)', async () => {
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
          email: 'john@example.com',
          phone: '555-5678',
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

      // Soft delete
      await kysely
        .updateTable('clients')
        .set({ deleted_at: now })
        .where('id', '=', 'client-1')
        .execute();

      const client = await kysely
        .selectFrom('clients')
        .selectAll()
        .where('id', '=', 'client-1')
        .executeTakeFirst();

      expect(client?.deleted_at).toBe(now);
    });

    it('should perform operations in <200ms', async () => {
      const kysely = manager.getKysely();
      const now = new Date().toISOString();

      const start = performance.now();

      await kysely
        .insertInto('clients')
        .values({
          id: 'client-perf',
          user_id: 'user-1',
          first_name: 'Jane',
          last_name: 'Smith',
          email: 'jane@example.com',
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

      const end = performance.now();
      const duration = end - start;

      expect(duration).toBeLessThan(200);
    });
  });

  describe('transactions', () => {
    it('should commit successful transactions', async () => {
      const kysely = manager.getKysely();
      const now = new Date().toISOString();

      await manager.transaction(async (trx) => {
        await trx
          .insertInto('users')
          .values({
            id: 'user-tx',
            business_name: 'TX Business',
            phone: null,
            timezone: 'America/New_York',
            service_area_miles: 25,
            created_at: now,
            updated_at: now,
            version: 1,
            synced_at: null,
            needs_sync: 0,
            sync_operation: null,
          })
          .execute();
      });

      const user = await kysely
        .selectFrom('users')
        .selectAll()
        .where('id', '=', 'user-tx')
        .executeTakeFirst();

      expect(user).toBeDefined();
    });

    it('should rollback failed transactions', async () => {
      const kysely = manager.getKysely();
      const now = new Date().toISOString();

      try {
        await manager.transaction(async (trx) => {
          await trx
            .insertInto('users')
            .values({
              id: 'user-fail',
              business_name: 'Fail Business',
              phone: null,
              timezone: 'America/New_York',
              service_area_miles: 25,
              created_at: now,
              updated_at: now,
              version: 1,
              synced_at: null,
              needs_sync: 0,
              sync_operation: null,
            })
            .execute();

          throw new Error('Force rollback');
        });
      } catch (error) {
        // Expected error
      }

      const user = await kysely
        .selectFrom('users')
        .selectAll()
        .where('id', '=', 'user-fail')
        .executeTakeFirst();

      expect(user).toBeUndefined();
    });
  });

  describe('statistics', () => {
    it('should return database statistics', async () => {
      const stats = await manager.getStats();

      expect(stats).toHaveProperty('users');
      expect(stats).toHaveProperty('clients');
      expect(stats).toHaveProperty('pets');
      expect(stats).toHaveProperty('services');
      expect(stats).toHaveProperty('appointments');
      expect(stats).toHaveProperty('sync_queue');
      expect(stats).toHaveProperty('needs_sync');

      expect(stats.users).toBe(0);
      expect(stats.clients).toBe(0);
    });

    it('should track record counts', async () => {
      const kysely = manager.getKysely();
      const now = new Date().toISOString();

      // Add 3 users
      for (let i = 1; i <= 3; i++) {
        await kysely
          .insertInto('users')
          .values({
            id: `user-${i}`,
            business_name: `Business ${i}`,
            phone: null,
            timezone: 'America/New_York',
            service_area_miles: 25,
            created_at: now,
            updated_at: now,
            version: 1,
            synced_at: null,
            needs_sync: 0,
            sync_operation: null,
          })
          .execute();
      }

      const stats = await manager.getStats();
      expect(stats.users).toBe(3);
    });
  });

  describe('data management', () => {
    it('should clear all data', async () => {
      const kysely = manager.getKysely();
      const now = new Date().toISOString();

      // Add data
      await kysely
        .insertInto('users')
        .values({
          id: 'user-clear',
          business_name: 'Clear Me',
          phone: null,
          timezone: 'America/New_York',
          service_area_miles: 25,
          created_at: now,
          updated_at: now,
          version: 1,
          synced_at: null,
          needs_sync: 0,
          sync_operation: null,
        })
        .execute();

      await manager.clearAllData();

      const stats = await manager.getStats();
      expect(stats.users).toBe(0);
    });
  });

  describe('singleton pattern', () => {
    it('should return same instance', () => {
      const instance1 = getSQLiteManager();
      const instance2 = getSQLiteManager();

      expect(instance1).toBe(instance2);
    });

    it('should reset singleton', () => {
      const instance1 = getSQLiteManager();
      resetSQLiteManager();
      const instance2 = getSQLiteManager();

      expect(instance1).not.toBe(instance2);
    });
  });
});
