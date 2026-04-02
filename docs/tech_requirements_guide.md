# KE Agenda V3 - Final Tech Requirements (No Changes Allowed)

> **LOCKED SPECIFICATION**: This document defines the EXACT tech stack. No substitutions, no "improvements," no alternatives. Follow exactly or fail.

## Core Architecture (NON-NEGOTIABLE)

### Local-First Data Flow
```
User Action → SQLite WASM (immediate response) → TanStack Query Cache → Background GraphQL Sync → PostgreSQL
```

**Rules:**
1. ALL user interactions hit SQLite first (0ms response time)
2. ALL data writes are optimistic with immediate UI updates
3. Server sync happens in background, failures are queued
4. App works offline for 72+ hours minimum
5. Network is ONLY for syncing, never for blocking operations

### Zero External Dependencies Philosophy
- **Database**: Standard PostgreSQL (portable to any host)
- **Auth**: Better Auth (stores data in YOUR database) 
- **GraphQL**: Hasura (sits on PostgreSQL, replaceable)
- **Cache**: SQLite WASM (client-side, no external service)
- **No SaaS dependencies** for core functionality

---

## Tech Stack (EXACT VERSIONS - DO NOT CHANGE)

### Frontend Dependencies
```json
{
  "next": "15.4.5",
  "react": "19.1.0",
  "typescript": "5.9.2",
  "@tanstack/react-query": "^5.59.0",
  "@tanstack/react-query-devtools": "^5.59.0",
  "graphql-request": "^7.1.0",
  "graphql": "^16.9.0",
  "@sqlite.org/sqlite-wasm": "^3.47.0",
  "kysely": "^0.27.0",
  "better-auth": "^0.8.0",
  "tailwindcss": "^4.0.0",
  "react-hook-form": "^7.53.0",
  "@hookform/resolvers": "^3.9.0",
  "zod": "^3.23.8",
  "date-fns": "^4.1.0",
  "uuid": "^10.0.0",
  "@types/uuid": "^10.0.0"
}
```

### Backend Stack
```yaml
Database: PostgreSQL 16+
GraphQL Engine: Hasura Cloud v2.42.0+
Auth: Better Auth (integrated with PostgreSQL)
File Storage: Cloudflare R2
Cache: Redis 7+ (for real-time subscriptions)
```

### External APIs (ONLY THESE)
```yaml
Weather: Tomorrow.io API
Maps: Google Maps Platform
  - Places API (address autocomplete)
  - Directions API (route optimization) 
  - Distance Matrix API (drive times)
Email: Resend.com
```

---

## Database Schema (PostgreSQL - EXACT STRUCTURE)

### Core Tables (MUST MATCH EXACTLY)
```sql
-- Auth tables (managed by Better Auth)
CREATE TABLE auth_user (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  email_verified BOOLEAN NOT NULL DEFAULT FALSE,
  name TEXT,
  image TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE auth_session (
  id TEXT PRIMARY KEY,
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  token TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE
);

CREATE TABLE auth_account (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  provider_id TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES auth_user(id) ON DELETE CASCADE,
  access_token TEXT,
  refresh_token TEXT,
  id_token TEXT,
  access_token_expires_at TIMESTAMP WITH TIME ZONE,
  refresh_token_expires_at TIMESTAMP WITH TIME ZONE,
  scope TEXT,
  password TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Business tables
CREATE TABLE users (
  id TEXT PRIMARY KEY REFERENCES auth_user(id),
  business_name TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  service_area_miles INTEGER DEFAULT 25,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Sync tracking
  version INTEGER DEFAULT 1,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE clients (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Sync tracking
  version INTEGER DEFAULT 1,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE pets (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id TEXT NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  species TEXT NOT NULL CHECK (species IN ('dog', 'cat', 'bird', 'rabbit', 'other')),
  breed TEXT,
  size TEXT CHECK (size IN ('tiny', 'small', 'medium', 'large', 'giant')),
  age_years INTEGER,
  weight_lbs DECIMAL(5,2),
  behavior_notes TEXT,
  medical_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Sync tracking  
  version INTEGER DEFAULT 1,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE services (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price_cents INTEGER,
  weather_dependent BOOLEAN DEFAULT FALSE,
  location_type TEXT NOT NULL CHECK (location_type IN ('client_location', 'business_location', 'mobile')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Sync tracking
  version INTEGER DEFAULT 1,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

CREATE TABLE appointments (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  client_id TEXT NOT NULL REFERENCES clients(id),
  pet_id TEXT REFERENCES pets(id),
  service_id TEXT NOT NULL REFERENCES services(id),
  start_time TIMESTAMP WITH TIME ZONE NOT NULL,
  end_time TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT NOT NULL DEFAULT 'scheduled' 
    CHECK (status IN ('scheduled', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show')),
  location_type TEXT NOT NULL CHECK (location_type IN ('client_location', 'business_location', 'mobile')),
  address TEXT,
  latitude DECIMAL(10,8),
  longitude DECIMAL(11,8),
  notes TEXT,
  internal_notes TEXT,
  weather_alert BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Sync tracking
  version INTEGER DEFAULT 1,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Weather cache
CREATE TABLE weather_cache (
  id TEXT PRIMARY KEY,
  latitude DECIMAL(10,8) NOT NULL,
  longitude DECIMAL(11,8) NOT NULL,
  forecast_date DATE NOT NULL,
  temperature_f INTEGER,
  conditions TEXT,
  precipitation_probability INTEGER,
  wind_speed_mph INTEGER,
  is_outdoor_suitable BOOLEAN,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
  UNIQUE(latitude, longitude, forecast_date)
);

-- Route optimization cache
CREATE TABLE route_cache (
  id TEXT PRIMARY KEY,
  appointment_ids TEXT[] NOT NULL,
  optimized_order TEXT[] NOT NULL,
  total_duration_minutes INTEGER NOT NULL,
  total_distance_miles DECIMAL(8,2) NOT NULL,
  cached_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Indexes for performance
CREATE INDEX idx_clients_user_id ON clients(user_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_pets_client_id ON pets(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_user_id_date ON appointments(user_id, start_time) WHERE deleted_at IS NULL;
CREATE INDEX idx_appointments_client_id ON appointments(client_id) WHERE deleted_at IS NULL;
CREATE INDEX idx_weather_location_date ON weather_cache(latitude, longitude, forecast_date);
```

---

## SQLite Schema (Client-Side - MUST MATCH PostgreSQL)

### Local Tables (EXACT MIRROR)
```sql
-- Local mirror of server tables (same structure)
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  business_name TEXT,
  phone TEXT,
  timezone TEXT DEFAULT 'America/New_York',
  service_area_miles INTEGER DEFAULT 25,
  created_at TEXT,
  updated_at TEXT,
  version INTEGER DEFAULT 1,
  synced_at TEXT,
  -- Local-only fields
  needs_sync BOOLEAN DEFAULT 0,
  sync_operation TEXT -- INSERT, UPDATE, DELETE
);

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
  created_at TEXT,
  updated_at TEXT,
  version INTEGER DEFAULT 1,
  synced_at TEXT,
  deleted_at TEXT,
  -- Local-only fields
  needs_sync BOOLEAN DEFAULT 0,
  sync_operation TEXT
);

CREATE TABLE pets (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  name TEXT NOT NULL,
  species TEXT NOT NULL,
  breed TEXT,
  size TEXT,
  age_years INTEGER,
  weight_lbs REAL,
  behavior_notes TEXT,
  medical_notes TEXT,
  created_at TEXT,
  updated_at TEXT,
  version INTEGER DEFAULT 1,
  synced_at TEXT,
  deleted_at TEXT,
  -- Local-only fields
  needs_sync BOOLEAN DEFAULT 0,
  sync_operation TEXT
);

CREATE TABLE services (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  duration_minutes INTEGER NOT NULL,
  price_cents INTEGER,
  weather_dependent BOOLEAN DEFAULT 0,
  location_type TEXT NOT NULL,
  created_at TEXT,
  updated_at TEXT,
  version INTEGER DEFAULT 1,
  synced_at TEXT,
  deleted_at TEXT,
  -- Local-only fields
  needs_sync BOOLEAN DEFAULT 0,
  sync_operation TEXT
);

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
  weather_alert BOOLEAN DEFAULT 0,
  created_at TEXT,
  updated_at TEXT,
  version INTEGER DEFAULT 1,
  synced_at TEXT,
  deleted_at TEXT,
  -- Local-only fields
  needs_sync BOOLEAN DEFAULT 0,
  sync_operation TEXT
);

-- TanStack Query cache storage
CREATE TABLE query_cache (
  query_key TEXT PRIMARY KEY,
  data TEXT NOT NULL, -- JSON serialized
  timestamp INTEGER NOT NULL,
  stale_time INTEGER NOT NULL,
  gc_time INTEGER NOT NULL
);

-- Offline mutation queue
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

-- Local indexes
CREATE INDEX idx_local_clients_user_id ON clients(user_id, deleted_at);
CREATE INDEX idx_local_appointments_user_date ON appointments(user_id, start_time, deleted_at);
CREATE INDEX idx_local_sync_queue ON sync_queue(created_at, attempts);
CREATE INDEX idx_local_needs_sync ON appointments(needs_sync) WHERE needs_sync = 1;
```

---

## Authentication Setup (Better Auth - EXACT CONFIG)

### Auth Configuration
```typescript
// lib/auth.ts
import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import Database from "better-sqlite3"

export const auth = betterAuth({
  database: drizzleAdapter(drizzle(new Database("./sqlite.db"))),
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
    minPasswordLength: 8,
    maxPasswordLength: 128
  },
  socialProviders: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    },
    apple: {
      clientId: process.env.APPLE_CLIENT_ID!,
      clientSecret: process.env.APPLE_CLIENT_SECRET!,
    }
  },
  session: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
    updateAge: 60 * 60 * 24, // 24 hours  
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5 // 5 minutes
    }
  },
  jwt: {
    expiresIn: 60 * 60 * 24 * 7, // 7 days
  },
  user: {
    additionalFields: {
      businessName: {
        type: "string",
        required: false
      },
      phone: {
        type: "string", 
        required: false
      }
    }
  },
  callbacks: {
    signIn: {
      after: async (user) => {
        // Create user profile in business tables
        await createUserProfile(user.id)
      }
    }
  }
})

export const { signIn, signOut, signUp, useSession } = auth
```

### Hasura JWT Integration
```yaml
# hasura/metadata.yaml
version: 3
sources:
  - name: default
    kind: postgres
    configuration:
      connection_info:
        database_url:
          from_env: HASURA_GRAPHQL_DATABASE_URL
    tables:
      - table: auth_user
        select_permissions:
          - role: user
            permission:
              columns: ['id', 'email', 'name', 'image', 'created_at']
              filter:
                id:
                  _eq: X-Hasura-User-Id
      - table: users
        select_permissions:
          - role: user
            permission:
              columns: '*'
              filter:
                id:
                  _eq: X-Hasura-User-Id
        insert_permissions:
          - role: user
            permission:
              columns: ['business_name', 'phone', 'timezone', 'service_area_miles']
              set:
                id: X-Hasura-User-Id
      - table: clients
        select_permissions:
          - role: user
            permission:
              columns: '*'
              filter:
                user_id:
                  _eq: X-Hasura-User-Id
                deleted_at:
                  _is_null: true
        insert_permissions:
          - role: user
            permission:
              columns: ['first_name', 'last_name', 'email', 'phone', 'address', 'latitude', 'longitude', 'notes']
              set:
                user_id: X-Hasura-User-Id
```

---

## GraphQL Schema (Auto-Generated by Hasura)

### Core Queries (EXACT STRUCTURE)
```graphql
# Get appointments for date range
query GetAppointments($start_date: timestamptz!, $end_date: timestamptz!, $user_id: String!) {
  appointments(
    where: {
      user_id: { _eq: $user_id }
      start_time: { _gte: $start_date, _lte: $end_date }
      deleted_at: { _is_null: true }
    }
    order_by: { start_time: asc }
  ) {
    id
    start_time
    end_time
    status
    address
    latitude
    longitude
    notes
    weather_alert
    version
    client {
      id
      first_name
      last_name
      phone
      address
      latitude
      longitude
    }
    pet {
      id
      name
      species
      breed
      size
      behavior_notes
    }
    service {
      id
      name
      duration_minutes
      price_cents
      weather_dependent
    }
  }
}

# Get clients with pets
query GetClientsWithPets($user_id: String!) {
  clients(
    where: {
      user_id: { _eq: $user_id }
      deleted_at: { _is_null: true }
    }
    order_by: { last_name: asc }
  ) {
    id
    first_name
    last_name
    email
    phone
    address
    latitude
    longitude
    notes
    version
    pets(where: { deleted_at: { _is_null: true } }) {
      id
      name
      species
      breed
      size
      age_years
      weight_lbs
      behavior_notes
      medical_notes
    }
  }
}

# Create appointment
mutation CreateAppointment($appointment: appointments_insert_input!) {
  insert_appointments_one(object: $appointment) {
    id
    start_time
    end_time
    status
    version
    created_at
  }
}

# Update appointment
mutation UpdateAppointment($id: String!, $updates: appointments_set_input!) {
  update_appointments_by_pk(pk_columns: { id: $id }, _set: $updates) {
    id
    version
    updated_at
  }
}

# Real-time appointment updates
subscription AppointmentUpdates($user_id: String!) {
  appointments(
    where: { 
      user_id: { _eq: $user_id }
      deleted_at: { _is_null: true }
    }
  ) {
    id
    start_time
    end_time
    status
    version
    client {
      first_name
      last_name
    }
    service {
      name
    }
  }
}
```

---

## Local-First Implementation (EXACT PATTERNS)

### SQLite Database Manager with Kysely
```typescript
// lib/database/sqlite-manager.ts
import initSqlite from '@sqlite.org/sqlite-wasm'
import type { Database as SqliteDatabase } from '@sqlite.org/sqlite-wasm'
import { Kysely, SqliteDialect } from 'kysely'

// Database interface for Kysely
interface Database {
  users: UserTable
  clients: ClientTable
  pets: PetTable
  services: ServiceTable
  appointments: AppointmentTable
  query_cache: QueryCacheTable
  sync_queue: SyncQueueTable
}

interface UserTable {
  id: string
  business_name: string | null
  phone: string | null
  timezone: string
  service_area_miles: number
  created_at: string
  updated_at: string
  version: number
  synced_at: string | null
  needs_sync: boolean
  sync_operation: string | null
}

interface ClientTable {
  id: string
  user_id: string
  first_name: string
  last_name: string
  email: string | null
  phone: string | null
  address: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  created_at: string
  updated_at: string
  version: number
  synced_at: string | null
  deleted_at: string | null
  needs_sync: boolean
  sync_operation: string | null
}

interface AppointmentTable {
  id: string
  user_id: string
  client_id: string
  pet_id: string | null
  service_id: string
  start_time: string
  end_time: string
  status: 'scheduled' | 'confirmed' | 'in_progress' | 'completed' | 'cancelled' | 'no_show'
  location_type: 'client_location' | 'business_location' | 'mobile'
  address: string | null
  latitude: number | null
  longitude: number | null
  notes: string | null
  internal_notes: string | null
  weather_alert: boolean
  created_at: string
  updated_at: string
  version: number
  synced_at: string | null
  deleted_at: string | null
  needs_sync: boolean
  sync_operation: string | null
}

// Other table interfaces...

export class SQLiteManager {
  private rawDb: SqliteDatabase | null = null
  private isInitialized = false

  async initialize(): Promise<void> {
    if (this.isInitialized) return

    try {
      const sqlite3 = await initSqlite({
        print: console.log,
        printErr: console.error
      })
      
      this.rawDb = new sqlite3.oo1.DB(':memory:')
      await this.runMigrations()
      this.isInitialized = true
      
      console.log('SQLite initialized successfully')
    } catch (error) {
      console.error('SQLite initialization failed:', error)
      throw new Error('Failed to initialize SQLite')
    }
  }

  getRawDatabase(): SqliteDatabase {
    if (!this.rawDb) throw new Error('Database not initialized')
    return this.rawDb
  }

  async execute(sql: string, params: any[] = []): Promise<void> {
    if (!this.rawDb) throw new Error('Database not initialized')

    const stmt = this.rawDb.prepare(sql)
    try {
      stmt.bind(params)
      stmt.step()
    } finally {
      stmt.finalize()
    }
  }

  async transaction<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.rawDb) throw new Error('Database not initialized')

    await this.execute('BEGIN TRANSACTION')
    try {
      const result = await fn()
      await this.execute('COMMIT')
      return result
    } catch (error) {
      await this.execute('ROLLBACK')
      throw error
    }
  }

  private async runMigrations(): Promise<void> {
    // Run all schema creation SQL from above
    // This would be the complete SQLite schema
  }
}

export const sqliteDB = new SQLiteManager()

// Kysely database instance
export const db = new Kysely<Database>({
  dialect: new SqliteDialect({
    database: {
      // Custom database adapter for sqlite-wasm
      exec: (sql: string) => {
        sqliteDB.getRawDatabase().exec(sql)
      },
      prepare: (sql: string) => {
        const rawDb = sqliteDB.getRawDatabase()
        const stmt = rawDb.prepare(sql)
        
        return {
          all: (params?: any[]) => {
            if (params) stmt.bind(params)
            const results: any[] = []
            while (stmt.step()) {
              results.push(stmt.getAsObject())
            }
            stmt.finalize()
            return results
          },
          get: (params?: any[]) => {
            if (params) stmt.bind(params)
            const result = stmt.step() ? stmt.getAsObject() : undefined
            stmt.finalize()
            return result
          },
          run: (params?: any[]) => {
            if (params) stmt.bind(params)
            stmt.step()
            const changes = rawDb.changes()
            stmt.finalize()
            return { changes }
          }
        }
      }
    } as any
  })
})
```

### TanStack Query Hooks with Kysely (EXACT PATTERNS)
```typescript
// hooks/use-appointments.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { request } from 'graphql-request'
import { db } from '@/lib/database/sqlite-manager'
import { GET_APPOINTMENTS, CREATE_APPOINTMENT } from '@/lib/graphql/queries'

export function useAppointments(startDate: Date, endDate: Date) {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['appointments', session?.user.id, startDate.toISOString(), endDate.toISOString()],
    queryFn: async () => {
      // ALWAYS try local first with Kysely
      const localAppointments = await db
        .selectFrom('appointments as a')
        .leftJoin('clients as c', 'a.client_id', 'c.id')
        .leftJoin('pets as p', 'a.pet_id', 'p.id')
        .leftJoin('services as s', 'a.service_id', 's.id')
        .select([
          'a.id',
          'a.start_time',
          'a.end_time', 
          'a.status',
          'a.address',
          'a.latitude',
          'a.longitude',
          'a.notes',
          'a.weather_alert',
          'a.version',
          'c.first_name as client_first_name',
          'c.last_name as client_last_name',
          'c.phone as client_phone',
          'c.address as client_address',
          'c.latitude as client_latitude',
          'c.longitude as client_longitude',
          'p.id as pet_id',
          'p.name as pet_name',
          'p.species as pet_species',
          'p.breed as pet_breed',
          'p.size as pet_size',
          'p.behavior_notes as pet_behavior_notes',
          's.id as service_id',
          's.name as service_name',
          's.duration_minutes as service_duration',
          's.price_cents as service_price',
          's.weather_dependent as service_weather_dependent'
        ])
        .where('a.user_id', '=', session?.user.id)
        .where('a.start_time', '>=', startDate.toISOString())
        .where('a.start_time', '<=', endDate.toISOString())
        .where('a.deleted_at', 'is', null)
        .orderBy('a.start_time', 'asc')
        .execute()

      // Background sync (non-blocking)
      if (navigator.onLine) {
        try {
          const { appointments } = await request(
            process.env.NEXT_PUBLIC_HASURA_URL!,
            GET_APPOINTMENTS,
            {
              start_date: startDate.toISOString(),
              end_date: endDate.toISOString(),
              user_id: session?.user.id
            },
            {
              Authorization: `Bearer ${session?.token}`
            }
          )

          // Update local cache with server data
          await syncAppointmentsToLocal(appointments)
          return appointments
        } catch (error) {
          console.warn('Server sync failed, using local data:', error)
        }
      }

      return localAppointments
    },
    enabled: !!session?.user.id,
    staleTime: 2 * 60 * 1000, // 2 minutes fresh
    gcTime: 30 * 60 * 1000,   // 30 minutes in cache
  })
}

export function useCreateAppointment() {
  const queryClient = useQueryClient()
  const { data: session } = useSession()

  return useMutation({
    mutationFn: async (appointmentData: CreateAppointmentData) => {
      const id = crypto.randomUUID()
      const now = new Date().toISOString()
      
      const appointment = {
        id,
        user_id: session!.user.id,
        ...appointmentData,
        created_at: now,
        updated_at: now,
        version: 1,
        synced_at: null,
        needs_sync: true,
        sync_operation: 'INSERT' as const
      }

      // Immediate local update with Kysely
      await db
        .insertInto('appointments')
        .values({
          id: appointment.id,
          user_id: appointment.user_id,
          client_id: appointment.client_id,
          pet_id: appointment.pet_id,
          service_id: appointment.service_id,
          start_time: appointment.start_time,
          end_time: appointment.end_time,
          status: appointment.status,
          location_type: appointment.location_type,
          address: appointment.address,
          latitude: appointment.latitude,
          longitude: appointment.longitude,
          notes: appointment.notes,
          created_at: appointment.created_at,
          updated_at: appointment.updated_at,
          version: appointment.version,
          needs_sync: appointment.needs_sync,
          sync_operation: appointment.sync_operation
        })
        .execute()

      // Optimistic UI update
      queryClient.setQueryData(['appointment', id], appointment)

      // Background sync
      if (navigator.onLine) {
        try {
          const result = await request(
            process.env.NEXT_PUBLIC_HASURA_URL!,
            CREATE_APPOINTMENT,
            { appointment },
            { Authorization: `Bearer ${session?.token}` }
          )

          // Mark as synced with Kysely
          await db
            .updateTable('appointments')
            .set({ 
              needs_sync: false, 
              synced_at: now 
            })
            .where('id', '=', id)
            .execute()

          return result.insert_appointments_one
        } catch (error) {
          console.warn('Server sync failed, queued for retry:', error)
          // Error is logged, but user sees success due to optimistic update
          return appointment
        }
      }

      return appointment
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['appointments'] })
    }
  })
}

// Additional helper hooks with Kysely
export function useClients() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['clients', session?.user.id],
    queryFn: async () => {
      return await db
        .selectFrom('clients')
        .selectAll()
        .where('user_id', '=', session?.user.id)
        .where('deleted_at', 'is', null)
        .orderBy(['last_name', 'first_name'])
        .execute()
    },
    enabled: !!session?.user.id
  })
}

export function useServices() {
  const { data: session } = useSession()

  return useQuery({
    queryKey: ['services', session?.user.id],
    queryFn: async () => {
      return await db
        .selectFrom('services')
        .selectAll()
        .where('user_id', '=', session?.user.id)
        .where('deleted_at', 'is', null)
        .orderBy('name')
        .execute()
    },
    enabled: !!session?.user.id
  })
}
```

---

## Weather Integration (EXACT API USAGE)

### Weather Service
```typescript
// lib/weather/weather-service.ts
interface WeatherData {
  temperature_f: number
  conditions: string
  precipitation_probability: number
  wind_speed_mph: number
  is_outdoor_suitable: boolean
  forecast_date: string
}

export class WeatherService {
  private apiKey = process.env.TOMORROW_IO_API_KEY!
  private baseUrl = 'https://api.tomorrow.io/v4'

  async getWeatherForecast(
    latitude: number, 
    longitude: number, 
    days: number = 7
  ): Promise<WeatherData[]> {
    // Check cache first
    const cached = await this.getCachedWeather(latitude, longitude, days)
    if (cached.length > 0) return cached

    try {
      const response = await fetch(
        `${this.baseUrl}/timelines?` + new URLSearchParams({
          location: `${latitude},${longitude}`,
          fields: 'temperature,weatherCode,precipitationProbability,windSpeed',
          timesteps: '1d',
          startTime: new Date().toISOString(),
          endTime: new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString(),
          units: 'imperial',
          apikey: this.apiKey
        })
      )

      if (!response.ok) {
        throw new Error(`Weather API error: ${response.status}`)
      }

      const data = await response.json()
      const weatherData = this.transformWeatherData(data)
      
      // Cache the results
      await this.cacheWeatherData(latitude, longitude, weatherData)
      
      return weatherData
    } catch (error) {
      console.error('Weather API failed:', error)
      return this.getFallbackWeather(days)
    }
  }

  async checkOutdoorServiceAlert(appointment: Appointment): Promise<boolean> {
    if (!appointment.service?.weather_dependent) return false
    if (!appointment.latitude || !appointment.longitude) return false

    const weather = await this.getWeatherForecast(
      appointment.latitude,
      appointment.longitude,
      1
    )

    const todayWeather = weather[0]
    return !todayWeather.is_outdoor_suitable
  }

  private transformWeatherData(apiResponse: any): WeatherData[] {
    return apiResponse.data.timelines[0].intervals.map((interval: any) => ({
      temperature_f: Math.round(interval.values.temperature),
      conditions: this.mapWeatherCode(interval.values.weatherCode),
      precipitation_probability: interval.values.precipitationProbability,
      wind_speed_mph: Math.round(interval.values.windSpeed),
      is_outdoor_suitable: this.isOutdoorSuitable(interval.values),
      forecast_date: interval.startTime.split('T')[0]
    }))
  }

  private isOutdoorSuitable(weather: any): boolean {
    // Conservative outdoor suitability rules
    return (
      weather.precipitationProbability < 40 && // Less than 40% chance of rain
      weather.windSpeed < 20 &&                // Less than 20 mph winds
      weather.temperature > 32 &&              // Above freezing
      weather.temperature < 95                 // Below 95°F
    )
  }

  private mapWeatherCode(code: number): string {
    const weatherCodes: Record<number, string> = {
      1000: 'Clear',
      1100: 'Mostly Clear',
      1101: 'Partly Cloudy',
      1102: 'Mostly Cloudy',
      1001: 'Cloudy',
      2000: 'Fog',
      4000: 'Drizzle',
      4001: 'Rain',
      4200: 'Light Rain',
      4201: 'Heavy Rain',
      5000: 'Snow',
      5001: 'Flurries',
      5100: 'Light Snow',
      5101: 'Heavy Snow',
      6000: 'Freezing Drizzle',
      6001: 'Freezing Rain',
      6200: 'Light Freezing Rain',
      6201: 'Heavy Freezing Rain',
      7000: 'Ice Pellets',
      7101: 'Heavy Ice Pellets',
      7102: 'Light Ice Pellets',
      8000: 'Thunderstorm'
    }
    return weatherCodes[code] || 'Unknown'
  }

  private async getCachedWeather(
    latitude: number, 
    longitude: number, 
    days: number
  ): Promise<WeatherData[]> {
    const cached = await sqliteDB.query<WeatherData>(
      `SELECT * FROM weather_cache 
       WHERE latitude = ? AND longitude = ? 
       AND forecast_date >= date('now')
       AND forecast_date <= date('now', '+${days} days')
       AND datetime(expires_at) > datetime('now')
       ORDER BY forecast_date ASC`,
      [latitude, longitude]
    )
    return cached
  }
}

export const weatherService = new WeatherService()
```

---

## Route Optimization (EXACT GOOGLE MAPS USAGE)

### Route Service
```typescript
// lib/routes/route-service.ts
interface RouteOptimization {
  optimized_appointments: Appointment[]
  total_duration_minutes: number
  total_distance_miles: number
  route_polyline: string
}

export class RouteService {
  private apiKey = process.env.GOOGLE_MAPS_API_KEY!

  async optimizeAppointmentRoute(appointments: Appointment[]): Promise<RouteOptimization> {
    if (appointments.length <= 1) {
      return {
        optimized_appointments: appointments,
        total_duration_minutes: 0,
        total_distance_miles: 0,
        route_polyline: ''
      }
    }

    // Check cache first
    const cacheKey = appointments.map(a => a.id).sort().join(',')
    const cached = await this.getCachedRoute(cacheKey)
    if (cached) return cached

    try {
      // Get Google Directions with waypoint optimization
      const waypoints = appointments.slice(1, -1).map(a => `${a.latitude},${a.longitude}`)
      
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/directions/json?` + new URLSearchParams({
          origin: `${appointments[0].latitude},${appointments[0].longitude}`,
          destination: `${appointments[appointments.length - 1].latitude},${appointments[appointments.length - 1].longitude}`,
          waypoints: `optimize:true|${waypoints.join('|')}`,
          key: this.apiKey
        })
      )

      const data = await response.json()
      
      if (data.status !== 'OK') {
        throw new Error(`Directions API error: ${data.status}`)
      }

      const result = this.processDirectionsResponse(data, appointments)
      
      // Cache the result
      await this.cacheRoute(cacheKey, result)
      
      return result
    } catch (error) {
      console.error('Route optimization failed:', error)
      return {
        optimized_appointments: appointments,
        total_duration_minutes: this.estimateTotalDuration(appointments),
        total_distance_miles: this.estimateTotalDistance(appointments),
        route_polyline: ''
      }
    }
  }

  async calculateDrivingTime(
    from: { latitude: number, longitude: number },
    to: { latitude: number, longitude: number }
  ): Promise<number> {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/distancematrix/json?` + new URLSearchParams({
          origins: `${from.latitude},${from.longitude}`,
          destinations: `${to.latitude},${to.longitude}`,
          units: 'imperial',
          departure_time: 'now',
          traffic_model: 'best_guess',
          key: this.apiKey
        })
      )

      const data = await response.json()
      
      if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
        return Math.ceil(data.rows[0].elements[0].duration_in_traffic.value / 60) // Convert to minutes
      }
    } catch (error) {
      console.error('Distance Matrix API failed:', error)
    }

    // Fallback estimation: ~25 mph average with city driving
    const distance = this.calculateHaversineDistance(from, to)
    return Math.ceil((distance / 25) * 60) // minutes
  }

  private processDirectionsResponse(
    data: any, 
    originalAppointments: Appointment[]
  ): RouteOptimization {
    const route = data.routes[0]
    const waypointOrder = route.waypoint_order || []
    
    // Reconstruct optimized order
    const optimized = [originalAppointments[0]] // Start with first appointment
    
    // Add waypoints in optimized order
    waypointOrder.forEach((index: number) => {
      optimized.push(originalAppointments[index + 1])
    })
    
    // Add last appointment
    if (originalAppointments.length > 1) {
      optimized.push(originalAppointments[originalAppointments.length - 1])
    }

    const totalDuration = route.legs.reduce((sum: number, leg: any) => 
      sum + Math.ceil(leg.duration_in_traffic?.value / 60 || leg.duration.value / 60), 0)
    
    const totalDistance = route.legs.reduce((sum: number, leg: any) => 
      sum + (leg.distance.value * 0.000621371), 0) // Convert meters to miles

    return {
      optimized_appointments: optimized,
      total_duration_minutes: totalDuration,
      total_distance_miles: Math.round(totalDistance * 100) / 100,
      route_polyline: route.overview_polyline.points
    }
  }

  private calculateHaversineDistance(
    from: { latitude: number, longitude: number },
    to: { latitude: number, longitude: number }
  ): number {
    const R = 3959 // Earth's radius in miles
    const dLat = (to.latitude - from.latitude) * Math.PI / 180
    const dLon = (to.longitude - from.longitude) * Math.PI / 180
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(from.latitude * Math.PI / 180) * Math.cos(to.latitude * Math.PI / 180) *
      Math.sin(dLon/2) * Math.sin(dLon/2)
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
    return R * c
  }
}

export const routeService = new RouteService()
```

---

## Project Structure (EXACT ORGANIZATION)

```
src/
├── app/                               # Next.js 15 App Router
│   ├── (auth)/
│   │   ├── sign-in/page.tsx
│   │   ├── sign-up/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── appointments/
│   │   │   ├── page.tsx              # Appointments list/calendar
│   │   │   ├── new/page.tsx          # Create appointment
│   │   │   └── [id]/page.tsx         # Edit appointment
│   │   ├── clients/
│   │   │   ├── page.tsx              # Clients list
│   │   │   ├── new/page.tsx          # Add client
│   │   │   └── [id]/page.tsx         # Client profile
│   │   ├── services/
│   │   │   ├── page.tsx              # Services management
│   │   │   └── new/page.tsx          # Add service
│   │   ├── routes/
│   │   │   └── page.tsx              # Route optimization
│   │   ├── weather/
│   │   │   └── page.tsx              # Weather dashboard
│   │   ├── settings/
│   │   │   └── page.tsx              # User settings
│   │   ├── page.tsx                  # Dashboard home
│   │   └── layout.tsx                # Dashboard layout
│   ├── api/
│   │   ├── auth/[...auth]/route.ts   # Better Auth API routes
│   │   ├── weather/route.ts          # Weather proxy endpoint
│   │   └── sync/route.ts             # Manual sync endpoint
│   ├── globals.css
│   ├── layout.tsx                    # Root layout
│   └── page.tsx                      # Landing page
├── components/
│   ├── ui/                           # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── input.tsx
│   │   ├── calendar.tsx
│   │   ├── dialog.tsx
│   │   └── [other-ui-components].tsx
│   ├── auth/
│   │   ├── sign-in-form.tsx
│   │   ├── sign-up-form.tsx
│   │   └── auth-provider.tsx
│   ├── appointments/
│   │   ├── appointment-calendar.tsx
│   │   ├── appointment-form.tsx
│   │   ├── appointment-card.tsx
│   │   └── appointment-list.tsx
│   ├── clients/
│   │   ├── client-form.tsx
│   │   ├── client-list.tsx
│   │   ├── client-card.tsx
│   │   └── pet-form.tsx
│   ├── weather/
│   │   ├── weather-card.tsx
│   │   ├── weather-alert.tsx
│   │   └── weather-forecast.tsx
│   ├── maps/
│   │   ├── route-map.tsx
│   │   ├── address-autocomplete.tsx
│   │   └── location-picker.tsx
│   └── layout/
│       ├── sidebar.tsx
│       ├── header.tsx
│       └── mobile-nav.tsx
├── hooks/
│   ├── use-appointments.ts
│   ├── use-clients.ts
│   ├── use-services.ts
│   ├── use-weather.ts
│   ├── use-routes.ts
│   ├── use-sync.ts
│   └── use-network-status.ts
├── lib/
│   ├── auth.ts                       # Better Auth configuration
│   ├── database/
│   │   ├── sqlite-manager.ts         # SQLite WASM + Kysely setup
│   │   ├── migrations.ts             # Database migrations
│   │   ├── sync-engine.ts            # Sync logic
│   │   └── types.ts                  # Kysely table interfaces
│   ├── graphql/
│   │   ├── client.ts                 # graphql-request client
│   │   ├── queries.ts                # GraphQL queries
│   │   └── mutations.ts              # GraphQL mutations
│   ├── weather/
│   │   └── weather-service.ts        # Weather API integration
│   ├── routes/
│   │   └── route-service.ts          # Google Maps integration
│   ├── utils.ts                      # Utility functions
│   └── constants.ts                  # App constants
├── providers/
│   ├── query-provider.tsx            # TanStack Query setup
│   ├── auth-provider.tsx             # Auth context
│   ├── database-provider.tsx         # SQLite context
│   └── sync-provider.tsx             # Background sync
├── types/
│   ├── auth.ts
│   ├── database.ts
│   ├── appointments.ts
│   ├── clients.ts
│   ├── weather.ts
│   └── routes.ts
└── middleware.ts                     # Auth middleware
```

---

## Environment Variables (EXACT CONFIG)

### Development (.env.local)
```bash
# Database
DATABASE_URL="postgresql://user:pass@localhost:5432/ke_agenda_dev"
HASURA_GRAPHQL_ADMIN_SECRET="dev_admin_secret_123"
HASURA_GRAPHQL_DATABASE_URL="postgresql://user:pass@localhost:5432/ke_agenda_dev"
HASURA_GRAPHQL_ENDPOINT="http://localhost:8080/v1/graphql"

# Auth
BETTER_AUTH_SECRET="your_32_char_random_string_here"
GOOGLE_CLIENT_ID="your_google_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="your_google_client_secret"
APPLE_CLIENT_ID="com.keagenda.app"
APPLE_CLIENT_SECRET="your_apple_client_secret"

# External APIs
TOMORROW_IO_API_KEY="your_tomorrow_io_api_key"
GOOGLE_MAPS_API_KEY="your_google_maps_api_key"
RESEND_API_KEY="your_resend_api_key"

# App Config
NEXT_PUBLIC_APP_URL="http://localhost:3025"
NEXT_PUBLIC_HASURA_URL="http://localhost:8080/v1/graphql"
NODE_ENV="development"
```

### Production (.env)
```bash
# Database  
DATABASE_URL="postgresql://prod_user:prod_pass@prod_host:5432/ke_agenda_prod"
HASURA_GRAPHQL_ADMIN_SECRET="prod_admin_secret_here"
HASURA_GRAPHQL_DATABASE_URL="postgresql://prod_user:prod_pass@prod_host:5432/ke_agenda_prod"
HASURA_GRAPHQL_ENDPOINT="https://hasura.keagenda.com/v1/graphql"

# Auth
BETTER_AUTH_SECRET="prod_32_char_random_string_here"
GOOGLE_CLIENT_ID="prod_google_client_id.apps.googleusercontent.com"
GOOGLE_CLIENT_SECRET="prod_google_client_secret"
APPLE_CLIENT_ID="com.keagenda.app"
APPLE_CLIENT_SECRET="prod_apple_client_secret"

# External APIs
TOMORROW_IO_API_KEY="prod_tomorrow_io_api_key"
GOOGLE_MAPS_API_KEY="prod_google_maps_api_key_with_restrictions"
RESEND_API_KEY="prod_resend_api_key"

# App Config
NEXT_PUBLIC_APP_URL="https://app.keagenda.com"
NEXT_PUBLIC_HASURA_URL="https://hasura.keagenda.com/v1/graphql"
NODE_ENV="production"
```

---

## Performance Requirements (NON-NEGOTIABLE TARGETS)

### Response Time Targets
- **SQLite queries**: <50ms for single records, <200ms for complex joins
- **UI interactions**: <100ms from click to visual feedback
- **Form submissions**: Immediate optimistic update, <16ms render time
- **Route calculations**: <5 seconds for 20+ stops
- **Weather updates**: <2 seconds for 7-day forecast

### Bundle Size Limits
- **Initial bundle**: <450KB gzipped (including Kysely ~50KB)
- **SQLite WASM**: Lazy-loaded, <2MB total
- **Route chunks**: <75KB per route
- **Font loading**: <100KB total, preloaded

### Offline Capabilities
- **Full functionality**: 72+ hours without network
- **Data persistence**: Survives browser restarts and crashes  
- **Sync recovery**: Automatic when network returns
- **Conflict resolution**: Automatic with user notification for manual conflicts

---

## Error Handling (MANDATORY PATTERNS)

### Global Error Boundaries
```typescript
// app/error.tsx
'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div className="min-h-screen flex items-center justify-center">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold">Something went wrong!</h1>
            <p className="text-gray-600">
              Don't worry - your data is safe and stored locally.
            </p>
            <div className="space-x-4">
              <button 
                onClick={reset}
                className="bg-blue-500 text-white px-4 py-2 rounded"
              >
                Try Again
              </button>
              <button 
                onClick={() => window.location.reload()}
                className="bg-gray-500 text-white px-4 py-2 rounded"
              >
                Refresh Page
              </button>
            </div>
            {process.env.NODE_ENV === 'development' && (
              <details className="mt-4 p-4 bg-gray-100 rounded">
                <summary>Error Details (Dev Only)</summary>
                <pre className="text-left text-sm mt-2 overflow-auto">
                  {error.message}
                  {error.stack}
                </pre>
              </details>
            )}
          </div>
        </div>
      </body>
    </html>
  )
}
```

### Network Error Handling
```typescript
// lib/error-handling.ts
export class NetworkError extends Error {
  constructor(message: string, public status?: number) {
    super(message)
    this.name = 'NetworkError'
  }
}

export class SyncError extends Error {
  constructor(message: string, public operation: string, public data: any) {
    super(message)
    this.name = 'SyncError'
  }
}

export function handleApiError(error: unknown): never {
  if (error instanceof Response) {
    throw new NetworkError(`API Error: ${error.status}`, error.status)
  }
  
  if (error instanceof Error) {
    if (error.message.includes('fetch')) {
      throw new NetworkError('Network connection failed')
    }
    throw error
  }
  
  throw new Error('Unknown error occurred')
}

export function logError(error: Error, context?: Record<string, any>) {
  console.error('Application Error:', {
    message: error.message,
    name: error.name,
    stack: error.stack,
    context,
    timestamp: new Date().toISOString()
  })
  
  // In production, send to error tracking service
  if (process.env.NODE_ENV === 'production') {
    // TODO: Implement error tracking (Sentry, etc.)
  }
}
```

---

## Testing Requirements (MANDATORY COVERAGE)

### Unit Tests with Kysely (Required Files)
```typescript
// __tests__/lib/database/sqlite-manager.test.ts
import { SQLiteManager, db } from '@/lib/database/sqlite-manager'

describe('SQLiteManager with Kysely', () => {
  let sqliteManager: SQLiteManager

  beforeEach(async () => {
    sqliteManager = new SQLiteManager()
    await sqliteManager.initialize()
  })

  test('should initialize successfully', async () => {
    expect(sqliteManager.isInitialized).toBe(true)
  })

  test('should store and retrieve appointments with Kysely', async () => {
    const appointment = {
      id: 'test-1',
      user_id: 'user-1',
      client_id: 'client-1',
      service_id: 'service-1',
      start_time: '2024-01-01T10:00:00Z',
      end_time: '2024-01-01T11:00:00Z',
      status: 'scheduled' as const,
      location_type: 'client_location' as const,
      weather_alert: false,
      created_at: '2024-01-01T09:00:00Z',
      updated_at: '2024-01-01T09:00:00Z',
      version: 1,
      needs_sync: true,
      sync_operation: 'INSERT' as const
    }

    // Insert with Kysely
    await db
      .insertInto('appointments')
      .values(appointment)
      .execute()

    // Retrieve with Kysely
    const results = await db
      .selectFrom('appointments')
      .selectAll()
      .where('id', '=', appointment.id)
      .execute()

    expect(results[0]).toMatchObject(appointment)
  })

  test('should handle complex queries with joins', async () => {
    // Insert test data
    const client = {
      id: 'client-1',
      user_id: 'user-1', 
      first_name: 'John',
      last_name: 'Doe',
      created_at: '2024-01-01T09:00:00Z',
      updated_at: '2024-01-01T09:00:00Z',
      version: 1,
      needs_sync: true,
      sync_operation: 'INSERT' as const
    }

    await db.insertInto('clients').values(client).execute()

    // Complex query with join
    const results = await db
      .selectFrom('appointments as a')
      .leftJoin('clients as c', 'a.client_id', 'c.id')
      .select(['a.id', 'c.first_name', 'c.last_name'])
      .where('a.user_id', '=', 'user-1')
      .execute()

    expect(results).toBeDefined()
  })

  test('should handle transactions', async () => {
    await expect(
      sqliteManager.transaction(async () => {
        await db.insertInto('appointments').values({
          id: 'test',
          user_id: 'user-1',
          client_id: 'client-1',
          service_id: 'service-1',
          start_time: '2024-01-01T10:00:00Z',
          end_time: '2024-01-01T11:00:00Z',
          status: 'scheduled',
          location_type: 'client_location',
          weather_alert: false,
          created_at: '2024-01-01T09:00:00Z',
          updated_at: '2024-01-01T09:00:00Z',
          version: 1,
          needs_sync: true,
          sync_operation: 'INSERT'
        }).execute()
        
        throw new Error('Force rollback')
      })
    ).rejects.toThrow('Force rollback')

    const results = await db
      .selectFrom('appointments')
      .selectAll()
      .where('id', '=', 'test')
      .execute()
      
    expect(results).toHaveLength(0)
  })
})
```

### Integration Tests
```typescript
// __tests__/hooks/use-appointments.test.tsx
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAppointments } from '@/hooks/use-appointments'

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false }
    }
  })
  
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  )
}

describe('useAppointments', () => {
  test('should return appointments from local cache when offline', async () => {
    // Mock offline status
    Object.defineProperty(navigator, 'onLine', { value: false, writable: true })
    
    const { result } = renderHook(
      () => useAppointments(new Date('2024-01-01'), new Date('2024-01-07')),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.data).toBeDefined()
      expect(result.current.isLoading).toBe(false)
    })
  })

  test('should sync with server when online', async () => {
    Object.defineProperty(navigator, 'onLine', { value: true, writable: true })
    
    // Mock successful GraphQL response
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          appointments: []
        }
      })
    })

    const { result } = renderHook(
      () => useAppointments(new Date('2024-01-01'), new Date('2024-01-07')),
      { wrapper: createWrapper() }
    )

    await waitFor(() => {
      expect(result.current.data).toEqual([])
      expect(global.fetch).toHaveBeenCalled()
    })
  })
})
```

---

## Security Requirements (MANDATORY IMPLEMENTATION)

### Content Security Policy
```typescript
// next.config.js
const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: [
              "default-src 'self'",
              "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://maps.googleapis.com",
              "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
              "img-src 'self' data: blob: https:",
              "font-src 'self' https://fonts.gstatic.com",
              "connect-src 'self' https://api.tomorrow.io https://maps.googleapis.com https://*.hasura.app wss://*.hasura.app",
              "worker-src 'self' blob:",
              "object-src 'none'",
              "base-uri 'self'",
              "form-action 'self'",
              "frame-ancestors 'none'",
              "upgrade-insecure-requests"
            ].join('; ')
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY'
          },
          {
            key: 'X-Content-Type-Options', 
            value: 'nosniff'
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin'
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=(self)'
          }
        ]
      }
    ]
  }
}
```

### Input Validation (Zod Schemas)
```typescript
// types/validation.ts
import { z } from 'zod'

export const CreateAppointmentSchema = z.object({
  client_id: z.string().uuid(),
  pet_id: z.string().uuid().optional(),
  service_id: z.string().uuid(),
  start_time: z.string().datetime(),
  end_time: z.string().datetime(),
  location_type: z.enum(['client_location', 'business_location', 'mobile']),
  address: z.string().min(1).max(255).optional(),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
  notes: z.string().max(1000).optional()
})

export const CreateClientSchema = z.object({
  first_name: z.string().min(1).max(50),
  last_name: z.string().min(1).max(50),
  email: z.string().email().optional(),
  phone: z.string().regex(/^\+?[\d\s-()]{10,}$/).optional(),
  address: z.string().max(255).optional(),
  notes: z.string().max(1000).optional()
})

export const CreateServiceSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  duration_minutes: z.number().int().min(15).max(480), // 15 minutes to 8 hours
  price_cents: z.number().int().min(0).max(100000000), // Up to $1M
  weather_dependent: z.boolean().default(false),
  location_type: z.enum(['client_location', 'business_location', 'mobile'])
})

export type CreateAppointmentData = z.infer<typeof CreateAppointmentSchema>
export type CreateClientData = z.infer<typeof CreateClientSchema>
export type CreateServiceData = z.infer<typeof CreateServiceSchema>
```

---

## Deployment Configuration (EXACT SETUP)

### Docker Configuration
```dockerfile
# Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
WORKDIR /app

ENV NODE_ENV production
ENV NEXT_TELEMETRY_DISABLED 1

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3025
ENV PORT 3025

CMD ["node", "server.js"]
```

### Vercel Configuration
```json
{
  "version": 2,
  "builds": [
    {
      "src": "next.config.js",
      "use": "@vercel/next"
    }
  ],
  "env": {
    "NEXT_PUBLIC_APP_URL": "https://app.keagenda.com",
    "NEXT_PUBLIC_HASURA_URL": "https://hasura.keagenda.com/v1/graphql"
  },
  "headers": [
    {
      "source": "/(.*)",
      "headers": [
        {
          "key": "Cross-Origin-Embedder-Policy",
          "value": "require-corp"
        },
        {
          "key": "Cross-Origin-Opener-Policy",
          "value": "same-origin"
        }
      ]
    }
  ]
}
```

---

## FINAL ENFORCEMENT RULES

### ABSOLUTELY PROHIBITED
- ❌ **Supabase client libraries** (vendor lock-in)
- ❌ **Apollo Client** (overcomplicated caching)
- ❌ **Firebase** (wrong ecosystem)
- ❌ **Prisma** (adds ORM layer we don't need)
- ❌ **Any auth service other than Better Auth**
- ❌ **Any GraphQL client other than graphql-request**
- ❌ **Any SQLite implementation other than @sqlite.org/sqlite-wasm**

### MANDATORY PATTERNS
- ✅ **Local-first**: Every user action hits SQLite first
- ✅ **Optimistic updates**: UI updates immediately, sync in background  
- ✅ **Error resilience**: App works offline, queues failed syncs
- ✅ **Type safety**: Full TypeScript, no `any` types
- ✅ **Performance**: <200ms for local operations
- ✅ **Zero vendor lock-in**: All data portable to any backend

### SUCCESS CRITERIA CHECKLIST
Before any feature is considered complete:

- [ ] **Works offline** - Full functionality without network
- [ ] **Instant response** - <100ms from user action to UI update
- [ ] **Data integrity** - No data loss during sync conflicts
- [ ] **Error handling** - Graceful failures with user feedback
- [ ] **Type safety** - Full TypeScript coverage, no runtime type errors
- [ ] **Performance** - Meets all response time targets
- [ ] **Testing** - Unit tests + integration tests passing
- [ ] **Accessibility** - WCAG 2.1 AA compliance
- [ ] **Mobile optimized** - Works perfectly on iOS Safari PWA
- [ ] **Documentation** - Code is self-documenting with clear naming

**This specification is FINAL. No changes, no improvements, no alternatives. Follow exactly or the project will fail.**