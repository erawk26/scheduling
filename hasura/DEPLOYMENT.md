# Hasura Deployment Guide - KE Agenda V3

## Quick Start (Development)

### Using Docker Compose (Recommended)

```bash
cd hasura
docker-compose up -d

# Wait for services to be healthy (30 seconds)
sleep 30

# Apply Hasura metadata
hasura metadata apply --endpoint http://localhost:8080 --admin-secret myadminsecretkey
```

Access:
- **Hasura Console**: http://localhost:8080/console
- **GraphQL API**: http://localhost:8080/v1/graphql
- **Admin Secret**: `myadminsecretkey`

### Manual Setup

#### 1. Start PostgreSQL

```bash
docker run -d \
  --name ke-agenda-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ke_agenda \
  -p 5432:5432 \
  postgres:15-alpine
```

#### 2. Apply Schema

```bash
psql -h localhost -U postgres -d ke_agenda -f migrations/001_initial_schema.sql
```

#### 3. Start Hasura

```bash
docker run -d \
  --name ke-agenda-hasura \
  -p 8080:8080 \
  -e HASURA_GRAPHQL_DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/ke_agenda \
  -e HASURA_GRAPHQL_ENABLE_CONSOLE=true \
  -e HASURA_GRAPHQL_DEV_MODE=true \
  -e HASURA_GRAPHQL_ADMIN_SECRET=myadminsecretkey \
  -e HASURA_GRAPHQL_JWT_SECRET='{"type":"HS256","key":"your-256-bit-secret-key-change-in-production-min-32-chars"}' \
  hasura/graphql-engine:v2.36.0
```

#### 4. Apply Metadata

```bash
cd hasura
hasura metadata apply --endpoint http://localhost:8080 --admin-secret myadminsecretkey
```

## Schema Validation

```bash
cd sql
./validate_schema.sh
```

Expected output:
```
✅ All 10 tables created successfully
✅ All indexes created (12+ found)
✅ All 8 triggers created successfully
✅ All foreign keys created (10+ found)
✅ Check constraints created (5+ found)
```

## Environment Configuration

### Development (.env.local)

```bash
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/ke_agenda
HASURA_GRAPHQL_ADMIN_SECRET=myadminsecretkey
HASURA_GRAPHQL_ENDPOINT=http://localhost:8080/v1/graphql
HASURA_GRAPHQL_JWT_SECRET=your-256-bit-secret-key-change-in-production-min-32-chars
```

### Production (.env.production)

```bash
DATABASE_URL=postgresql://user:password@prod-host:5432/ke_agenda?sslmode=require
HASURA_GRAPHQL_ADMIN_SECRET=<STRONG_RANDOM_SECRET>
HASURA_GRAPHQL_ENDPOINT=https://hasura.yourdomain.com/v1/graphql
HASURA_GRAPHQL_JWT_SECRET=<BASE64_ENCODED_HS256_SECRET>
HASURA_GRAPHQL_ENABLE_CONSOLE=false
HASURA_GRAPHQL_DEV_MODE=false
```

## Database Schema Overview

### Tables Created

1. **Auth Tables** (Better Auth managed)
   - `auth_user` - User records
   - `auth_session` - Active sessions
   - `auth_account` - OAuth accounts

2. **Business Tables**
   - `users` - Business profiles
   - `clients` - Customer records (soft delete)
   - `pets` - Pet information
   - `services` - Service offerings
   - `appointments` - Scheduled appointments

3. **Cache Tables**
   - `weather_cache` - Weather forecasts
   - `route_cache` - Route optimizations

### Key Features

- **Soft Delete**: `clients`, `pets`, `services`, `appointments` use `deleted_at`
- **Version Tracking**: All business tables have `version` and `synced_at`
- **Automatic Timestamps**: Triggers update `updated_at` on every change
- **Row-Level Security**: All queries filtered by `user_id`
- **Performance Indexes**: 12+ indexes for fast queries

## GraphQL Schema

### Available Queries

```graphql
query GetClients {
  clients(where: {deleted_at: {_is_null: true}}) {
    id
    first_name
    last_name
    email
    phone
    address
    pets {
      id
      name
      species
    }
  }
}

query GetAppointments($start: timestamptz!, $end: timestamptz!) {
  appointments(
    where: {
      start_time: {_gte: $start, _lte: $end}
      deleted_at: {_is_null: true}
    }
    order_by: {start_time: asc}
  ) {
    id
    start_time
    end_time
    status
    client {
      first_name
      last_name
    }
    pet {
      name
    }
    service {
      name
      duration_minutes
    }
  }
}
```

### Available Mutations

```graphql
mutation CreateClient($input: clients_insert_input!) {
  insert_clients_one(object: $input) {
    id
    first_name
    last_name
    created_at
  }
}

mutation UpdateAppointment($id: String!, $status: String!) {
  update_appointments_by_pk(
    pk_columns: {id: $id}
    _set: {status: $status}
  ) {
    id
    status
    updated_at
  }
}

mutation SoftDeleteClient($id: String!) {
  update_clients_by_pk(
    pk_columns: {id: $id}
    _set: {deleted_at: "now()"}
  ) {
    id
    deleted_at
  }
}
```

## Security Configuration

### JWT Token Format

Better Auth must generate tokens with:

```json
{
  "sub": "user-id-here",
  "https://hasura.io/jwt/claims": {
    "x-hasura-default-role": "user",
    "x-hasura-allowed-roles": ["user"],
    "x-hasura-user-id": "user-id-here"
  }
}
```

### Row-Level Security Rules

All business tables are filtered by:
```yaml
filter:
  user_id:
    _eq: X-Hasura-User-Id
```

Deleted records are excluded:
```yaml
filter:
  deleted_at:
    _is_null: true
```

## Monitoring & Maintenance

### Health Checks

```bash
# PostgreSQL
psql -h localhost -U postgres -d ke_agenda -c "SELECT version();"

# Hasura
curl http://localhost:8080/healthz

# Check connection
curl -H "x-hasura-admin-secret: myadminsecretkey" \
  http://localhost:8080/v1/version
```

### Database Backup

```bash
# Full backup
pg_dump -h localhost -U postgres ke_agenda > backup_$(date +%Y%m%d).sql

# Schema only
pg_dump -h localhost -U postgres ke_agenda --schema-only > schema_backup.sql

# Data only
pg_dump -h localhost -U postgres ke_agenda --data-only > data_backup.sql
```

### Cache Cleanup

```bash
# Remove expired weather cache
psql -h localhost -U postgres -d ke_agenda -c \
  "DELETE FROM weather_cache WHERE expires_at < NOW();"

# Remove expired route cache
psql -h localhost -U postgres -d ke_agenda -c \
  "DELETE FROM route_cache WHERE expires_at < NOW();"
```

## Troubleshooting

### Connection Refused

```bash
# Check PostgreSQL is running
docker ps | grep postgres

# Check port availability
lsof -i :5432

# Restart PostgreSQL
docker restart ke-agenda-postgres
```

### Permission Denied

```bash
# Verify JWT token claims
echo $JWT_TOKEN | base64 -d

# Check user_id matches
psql -h localhost -U postgres -d ke_agenda -c \
  "SELECT id FROM auth_user WHERE id = 'user-id-here';"
```

### Metadata Sync Issues

```bash
# Clear metadata
hasura metadata clear --endpoint http://localhost:8080 --admin-secret myadminsecretkey

# Reapply metadata
hasura metadata apply --endpoint http://localhost:8080 --admin-secret myadminsecretkey

# Reload metadata
hasura metadata reload --endpoint http://localhost:8080 --admin-secret myadminsecretkey
```

## Production Deployment

### Prerequisites

- PostgreSQL 15+ with SSL enabled
- Hasura Cloud or self-hosted with SSL
- Strong admin secret (32+ characters)
- JWT secret matching Better Auth

### Steps

1. **Setup Database**
   ```bash
   # Apply migrations
   psql -h prod-host -U prod-user -d prod-db -f migrations/001_initial_schema.sql
   ```

2. **Configure Hasura**
   ```bash
   # Set environment variables
   HASURA_GRAPHQL_DATABASE_URL=postgresql://...
   HASURA_GRAPHQL_ADMIN_SECRET=<STRONG_SECRET>
   HASURA_GRAPHQL_JWT_SECRET=<JWT_SECRET>
   HASURA_GRAPHQL_ENABLE_CONSOLE=false
   HASURA_GRAPHQL_DEV_MODE=false
   ```

3. **Apply Metadata**
   ```bash
   hasura metadata apply --endpoint https://hasura.prod.com --admin-secret <ADMIN_SECRET>
   ```

4. **Enable Monitoring**
   - Setup health check endpoints
   - Configure logging aggregation
   - Enable query analytics
   - Setup alerts for errors

5. **Security Hardening**
   - Enable rate limiting
   - Configure CORS policies
   - Setup API gateway
   - Enable query depth limits

## Migration Guide

### Adding New Tables

1. Create migration SQL file:
   ```bash
   cd migrations
   touch 002_add_new_table.sql
   ```

2. Add table definition and indexes

3. Update `metadata/tables.yaml` with tracking

4. Update `metadata/permissions.yaml` with RLS

5. Apply migration:
   ```bash
   psql -h localhost -U postgres -d ke_agenda -f migrations/002_add_new_table.sql
   hasura metadata apply
   ```

### Modifying Existing Tables

1. Create migration with ALTER statements
2. Update metadata if relationships change
3. Test in development first
4. Apply to production during low-traffic window

## References

- [Hasura Documentation](https://hasura.io/docs/latest/)
- [PostgreSQL 15 Docs](https://www.postgresql.org/docs/15/)
- [Better Auth JWT](https://better-auth.com)
- [Docker Compose](https://docs.docker.com/compose/)
