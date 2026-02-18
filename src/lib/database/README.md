# SQLite WASM + Kysely Database Layer

Local-first database implementation for KE Agenda V3.

## Overview

This module provides a complete local-first database layer using SQLite WASM and Kysely for type-safe queries. All operations complete in <200ms and work offline for 72+ hours.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Application                     │
├─────────────────────────────────────────────────────────┤
│              DatabaseProvider (Context)                  │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────────┐         ┌──────────────────┐     │
│  │  SQLiteManager   │         │   SyncEngine     │     │
│  │                  │         │                  │     │
│  │ - Initialize     │◄────────┤ - Queue mutations│     │
│  │ - Transactions   │         │ - Background sync│     │
│  │ - Statistics     │         │ - Conflict res.  │     │
│  └────────┬─────────┘         └──────────────────┘     │
│           │                                              │
│           ▼                                              │
│  ┌──────────────────┐                                   │
│  │  Kysely (ORM)    │                                   │
│  │ Type-safe queries│                                   │
│  └────────┬─────────┘                                   │
│           │                                              │
│           ▼                                              │
│  ┌──────────────────┐                                   │
│  │  SQLite WASM     │                                   │
│  │ In-memory DB     │                                   │
│  └──────────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

## Core Components

### 1. SQLiteManager (`sqlite-manager.ts`)

Manages the SQLite WASM instance and provides database access.

**Key Features:**
- Singleton pattern for app-wide access
- Automatic schema migration
- Transaction support with rollback
- Database statistics and monitoring
- <200ms operation guarantee

**Usage:**
```typescript
import { getSQLiteManager } from '@/lib/database';

const manager = getSQLiteManager();
await manager.initialize();

const kysely = manager.getKysely();
const stats = await manager.getStats();
```

### 2. SyncEngine (`sync-engine.ts`)

Handles offline mutations and background synchronization.

**Key Features:**
- Non-blocking mutation queue
- Exponential backoff on failures
- Last-write-wins conflict resolution
- Background sync worker
- needs_sync flag tracking

**Usage:**
```typescript
import { SyncEngine } from '@/lib/database';

const syncEngine = new SyncEngine(kysely);

// Queue a mutation (never blocks)
await syncEngine.queueMutation('clients', 'CREATE', 'id', data);

// Get sync status
const status = await syncEngine.getSyncStatus();

// Manual sync trigger
await syncEngine.syncNow();
```

### 3. Database Types (`types.ts`)

TypeScript types matching PostgreSQL schema exactly.

**Key Features:**
- Full type safety with Kysely
- Selectable, Insertable, Updateable helpers
- Local-only fields (needs_sync, sync_operation)
- Sync result types

**Usage:**
```typescript
import type { Client, NewClient, ClientUpdate } from '@/lib/database';

const newClient: NewClient = {
  user_id: 'user-1',
  first_name: 'John',
  last_name: 'Doe',
  // ... other fields
};
```

### 4. Migrations (`migrations.ts`)

Database schema creation and migration.

**Key Features:**
- Matches PostgreSQL schema exactly
- Includes all indexes
- Local-only tables (query_cache, sync_queue)
- Automatic execution on init

### 5. DatabaseProvider (`database-provider.tsx`)

React context provider for database access.

**Key Features:**
- Automatic initialization on mount
- Loading and error states
- Sync status monitoring
- Cleanup on unmount

**Usage:**
```typescript
// App setup
import { DatabaseProvider } from '@/providers/database-provider';

<DatabaseProvider>
  <App />
</DatabaseProvider>

// In components
import { useDatabase, useKysely, useSyncEngine } from '@/providers/database-provider';

function MyComponent() {
  const { isReady, error } = useDatabase();
  const kysely = useKysely();
  const syncEngine = useSyncEngine();

  // ... use database
}
```

## Local-First Pattern

**CRITICAL: All mutations MUST follow this pattern:**

```typescript
import { createLocalFirst, updateLocalFirst, deleteLocalFirst } from '@/lib/database';

// CREATE
const client = await createLocalFirst(kysely, syncEngine, 'clients', {
  user_id: 'user-1',
  first_name: 'John',
  last_name: 'Doe',
  // ... other fields
});
// Returns immediately with local record
// Queued for background sync

// UPDATE
await updateLocalFirst(kysely, syncEngine, 'clients', 'client-id', {
  first_name: 'Jane',
});
// Updates local immediately
// Queued for background sync

// DELETE (soft delete)
await deleteLocalFirst(kysely, syncEngine, 'clients', 'client-id');
// Marks deleted_at locally
// Queued for background sync
```

## Database Schema

### Core Tables

All tables include these local-only fields:
- `needs_sync` (INTEGER): 0 = synced, 1 = needs sync
- `sync_operation` (TEXT): INSERT, UPDATE, or DELETE
- `synced_at` (TEXT): Last successful sync timestamp

#### Users
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  business_name TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  service_area_miles INTEGER DEFAULT 25,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  synced_at TEXT,
  needs_sync INTEGER DEFAULT 0,
  sync_operation TEXT
);
```

#### Clients
```sql
CREATE TABLE clients (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  latitude REAL,
  longitude REAL,
  notes TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  synced_at TEXT,
  deleted_at TEXT,
  needs_sync INTEGER DEFAULT 0,
  sync_operation TEXT
);
```

#### Appointments
```sql
CREATE TABLE appointments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  client_id TEXT NOT NULL,
  pet_id TEXT,
  service_id TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled',
  location_type TEXT NOT NULL,
  address TEXT,
  latitude REAL,
  longitude REAL,
  notes TEXT,
  internal_notes TEXT,
  weather_alert INTEGER DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  synced_at TEXT,
  deleted_at TEXT,
  needs_sync INTEGER DEFAULT 0,
  sync_operation TEXT
);
```

### Local-Only Tables

#### Query Cache (TanStack Query persistence)
```sql
CREATE TABLE query_cache (
  query_key TEXT PRIMARY KEY,
  data TEXT NOT NULL, -- JSON serialized
  timestamp INTEGER NOT NULL,
  stale_time INTEGER NOT NULL,
  gc_time INTEGER NOT NULL
);
```

#### Sync Queue (offline mutations)
```sql
CREATE TABLE sync_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  mutation_type TEXT NOT NULL, -- CREATE, UPDATE, DELETE
  table_name TEXT NOT NULL,
  record_id TEXT NOT NULL,
  data TEXT NOT NULL, -- JSON serialized
  created_at INTEGER NOT NULL,
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  retry_after INTEGER
);
```

## Performance Requirements

All operations MUST meet these requirements:

| Operation | Target | Notes |
|-----------|--------|-------|
| SELECT query | <50ms | Single record or small result set |
| INSERT | <100ms | Includes queue mutation |
| UPDATE | <100ms | Includes queue mutation |
| DELETE | <100ms | Soft delete + queue |
| Transaction | <200ms | Multiple operations |
| Sync queue | <50ms | Add to queue only |
| Background sync | N/A | Non-blocking, runs in worker |

## Offline Support

The database works completely offline with these guarantees:

1. **All CRUD operations work locally** - No network required
2. **Mutations queued automatically** - Synced when online
3. **Exponential backoff** - Failed syncs retry with increasing delays
4. **Conflict resolution** - Last-write-wins by version number
5. **72+ hour offline support** - All data cached locally

## Error Handling

All database operations include proper error handling:

```typescript
try {
  const client = await createLocalFirst(kysely, syncEngine, 'clients', data);
  return client;
} catch (error) {
  console.error('Failed to create client:', error);
  // Local operation failed - show user error
  throw error;
}

// Sync errors are handled automatically by SyncEngine
// with exponential backoff and retry
```

## Testing

Comprehensive test coverage in `tests/lib/database/`:

- `sqlite-manager.test.ts` - SQLite initialization, CRUD, transactions
- `sync-engine.test.ts` - Queue, sync, conflict resolution

**Run tests:**
```bash
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report (target: >80%)
```

## Common Patterns

### Query with Kysely
```typescript
const kysely = manager.getKysely();

// Select all clients for user
const clients = await kysely
  .selectFrom('clients')
  .selectAll()
  .where('user_id', '=', userId)
  .where('deleted_at', 'is', null)
  .orderBy('last_name', 'asc')
  .execute();

// Select appointments for date range
const appointments = await kysely
  .selectFrom('appointments')
  .selectAll()
  .where('user_id', '=', userId)
  .where('start_time', '>=', startDate)
  .where('start_time', '<', endDate)
  .where('deleted_at', 'is', null)
  .orderBy('start_time', 'asc')
  .execute();
```

### Transaction
```typescript
await manager.transaction(async (trx) => {
  // Create client
  const client = await trx
    .insertInto('clients')
    .values(clientData)
    .returning('id')
    .executeTakeFirstOrThrow();

  // Create pet for client
  await trx
    .insertInto('pets')
    .values({
      client_id: client.id,
      ...petData,
    })
    .execute();

  // Both succeed or both rollback
});
```

### Check Sync Status
```typescript
const status = await syncEngine.getSyncStatus();

if (status.pending_items > 0) {
  console.log(`${status.pending_items} items pending sync`);
}

if (status.last_error) {
  console.error('Last sync error:', status.last_error);
}
```

## Troubleshooting

### Database not initializing
- Check browser console for errors
- Verify SQLite WASM loaded correctly
- Ensure DatabaseProvider is mounted

### Sync not working
- Check network connectivity (`navigator.onLine`)
- Verify sync worker is running
- Check pending mutations: `syncEngine.getPendingMutations()`
- Look for failed items: `syncEngine.getSyncStatus()`

### Performance issues
- Check operation timing with `performance.now()`
- Verify indexes exist for queries
- Use transactions for bulk operations
- Monitor database size: `manager.getStats()`

### Type errors
- Ensure types.ts matches PostgreSQL schema
- Use proper Kysely types (Selectable, Insertable, Updateable)
- Check for null/undefined handling

## Future Enhancements

- [ ] Persistent storage (IndexedDB) for session recovery
- [ ] Compression for large data sets
- [ ] Partial sync (only changed records)
- [ ] Multi-device sync conflict UI
- [ ] Sync progress tracking
- [ ] Background sync with Service Worker

## References

- [SQLite WASM](https://sqlite.org/wasm/doc/trunk/index.md)
- [Kysely Documentation](https://kysely.dev/)
- [Tech Requirements Guide](../../../docs/tech_requirements_guide.md)
- [AI Guardrails](../../../docs/AI_GUARDRAILS.md)
