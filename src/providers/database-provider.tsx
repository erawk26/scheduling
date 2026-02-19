/**
 * Database Provider - React Context for SQLite
 *
 * Provides database and sync engine to entire application
 * Initializes on mount, handles cleanup on unmount
 */

'use client';

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Kysely } from 'kysely';
import {
  getSQLiteManager,
  SyncEngine,
  type Database,
  type SyncStatus,
} from '@/lib/database';

interface DatabaseContextValue {
  db: Kysely<Database> | null;
  syncEngine: SyncEngine | null;
  isReady: boolean;
  error: string | null;
  syncStatus: SyncStatus | null;
  refreshSyncStatus: () => Promise<void>;
}

const DatabaseContext = createContext<DatabaseContextValue>({
  db: null,
  syncEngine: null,
  isReady: false,
  error: null,
  syncStatus: null,
  refreshSyncStatus: async () => {},
});

/**
 * Hook to access database context
 */
export function useDatabase() {
  const context = useContext(DatabaseContext);

  if (!context) {
    throw new Error('useDatabase must be used within DatabaseProvider');
  }

  return context;
}

/**
 * Database Provider Component
 */
export function DatabaseProvider({ children }: { children: React.ReactNode }) {
  const [db, setDb] = useState<Kysely<Database> | null>(null);
  const [syncEngine, setSyncEngine] = useState<SyncEngine | null>(null);
  const syncEngineRef = useRef<SyncEngine | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncStatus | null>(null);

  // Initialize database on mount
  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        console.log('[DatabaseProvider] Initializing SQLite...');

        // Get singleton instance
        const manager = getSQLiteManager();

        // Initialize SQLite WASM
        await manager.initialize();

        if (!mounted) return;

        // Get Kysely instance
        const kyselyDb = manager.getKysely();
        setDb(kyselyDb);

        // Create sync engine
        const sync = new SyncEngine(kyselyDb);
        syncEngineRef.current = sync;
        setSyncEngine(sync);

        // Start background sync worker
        sync.startSyncWorker();

        // Get initial sync status
        const status = await sync.getSyncStatus();
        setSyncStatus(status);

        setIsReady(true);
        console.log('[DatabaseProvider] Ready');
      } catch (err) {
        console.error('[DatabaseProvider] Initialization failed:', err);
        if (mounted) {
          setError(
            err instanceof Error ? err.message : 'Failed to initialize database'
          );
        }
      }
    }

    init();

    // Cleanup on unmount
    return () => {
      mounted = false;
      if (syncEngineRef.current) {
        syncEngineRef.current.stopSyncWorker();
      }
    };
  }, []);

  // Refresh sync status periodically
  useEffect(() => {
    if (!syncEngine || !isReady) return;

    const interval = setInterval(async () => {
      try {
        const status = await syncEngine.getSyncStatus();
        setSyncStatus(status);
      } catch (err) {
        console.error('[DatabaseProvider] Failed to get sync status:', err);
      }
    }, 10000); // Every 10 seconds

    return () => clearInterval(interval);
  }, [syncEngine, isReady]);

  const refreshSyncStatus = async () => {
    if (!syncEngine) return;

    try {
      const status = await syncEngine.getSyncStatus();
      setSyncStatus(status);
    } catch (err) {
      console.error('[DatabaseProvider] Failed to refresh sync status:', err);
    }
  };

  const value: DatabaseContextValue = {
    db,
    syncEngine,
    isReady,
    error,
    syncStatus,
    refreshSyncStatus,
  };

  return (
    <DatabaseContext.Provider value={value}>
      {children}
    </DatabaseContext.Provider>
  );
}

/**
 * Hook to access database with type safety
 */
export function useKysely(): Kysely<Database> {
  const { db, isReady, error } = useDatabase();

  if (error) {
    throw new Error(`Database error: ${error}`);
  }

  if (!isReady || !db) {
    throw new Error('Database not ready. Ensure DatabaseProvider is mounted.');
  }

  return db;
}

/**
 * Hook to access sync engine
 */
export function useSyncEngine(): SyncEngine {
  const { syncEngine, isReady, error } = useDatabase();

  if (error) {
    throw new Error(`Database error: ${error}`);
  }

  if (!isReady || !syncEngine) {
    throw new Error('Sync engine not ready. Ensure DatabaseProvider is mounted.');
  }

  return syncEngine;
}

/**
 * Hook to get sync status
 */
export function useSyncStatus(): SyncStatus | null {
  const { syncStatus } = useDatabase();
  return syncStatus;
}
