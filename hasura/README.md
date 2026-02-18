# Hasura GraphQL Configuration

This directory contains Hasura metadata and migrations for KE Agenda V3.

## Directory Structure

```
hasura/
├── config.yaml              # Hasura CLI configuration
├── metadata/               # GraphQL schema and permissions
│   ├── version.yaml       # Metadata version
│   ├── databases.yaml     # Database connection config
│   ├── tables.yaml        # Table tracking and relationships
│   └── permissions.yaml   # Row-level security rules
└── migrations/            # SQL schema migrations
    └── 001_initial_schema.sql
```

## Database Schema

### Auth Tables (Better Auth)
- `auth_user` - User authentication records
- `auth_session` - Active sessions with expiration
- `auth_account` - OAuth provider accounts

### Business Tables
- `users` - Business profile data (extends auth_user)
- `clients` - Customer records with soft delete
- `pets` - Pet information linked to clients
- `services` - Service offerings with weather flags
- `appointments` - Scheduled appointments with versioning

### Cache Tables
- `weather_cache` - Weather forecasts (4-hour TTL)
- `route_cache` - Route optimization (1-hour TTL)

## Row-Level Security

All queries are filtered by `X-Hasura-User-Id` JWT claim:
- Users can only access their own data
- Soft-deleted records (`deleted_at IS NOT NULL`) are hidden
- Cache tables are read-only for all authenticated users

## Setup Instructions

### 1. Start PostgreSQL
```bash
docker run -d \
  --name ke-agenda-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=ke_agenda \
  -p 5432:5432 \
  postgres:15-alpine
```

### 2. Apply Schema Migration
```bash
psql -h localhost -U postgres -d ke_agenda -f migrations/001_initial_schema.sql
```

### 3. Start Hasura
```bash
docker run -d \
  --name ke-agenda-hasura \
  -p 8080:8080 \
  -e HASURA_GRAPHQL_DATABASE_URL=postgresql://postgres:postgres@host.docker.internal:5432/ke_agenda \
  -e HASURA_GRAPHQL_ENABLE_CONSOLE=true \
  -e HASURA_GRAPHQL_DEV_MODE=true \
  -e HASURA_GRAPHQL_ENABLED_LOG_TYPES="startup, http-log, webhook-log, websocket-log, query-log" \
  -e HASURA_GRAPHQL_ADMIN_SECRET=myadminsecretkey \
  -e HASURA_GRAPHQL_JWT_SECRET='{"type":"HS256","key":"your-256-bit-secret-key-here"}' \
  hasura/graphql-engine:v2.36.0
```

### 4. Apply Metadata
```bash
cd hasura
hasura metadata apply --endpoint http://localhost:8080 --admin-secret myadminsecretkey
```

## GraphQL Endpoint

- **Console**: http://localhost:8080/console
- **GraphQL API**: http://localhost:8080/v1/graphql
- **Admin Secret**: `myadminsecretkey` (change in production)

## JWT Configuration

Hasura expects JWT tokens from Better Auth with:
```json
{
  "sub": "user-id",
  "https://hasura.io/jwt/claims": {
    "x-hasura-default-role": "user",
    "x-hasura-allowed-roles": ["user"],
    "x-hasura-user-id": "user-id"
  }
}
```

## Example Queries

### Fetch User's Clients
```graphql
query GetClients {
  clients {
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
      breed
    }
  }
}
```

### Fetch Appointments for Date Range
```graphql
query GetAppointments($start: timestamptz!, $end: timestamptz!) {
  appointments(
    where: {
      start_time: { _gte: $start, _lte: $end }
    }
    order_by: { start_time: asc }
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
      species
    }
    service {
      name
      duration_minutes
    }
  }
}
```

### Create New Client
```graphql
mutation CreateClient($input: clients_insert_input!) {
  insert_clients_one(object: $input) {
    id
    first_name
    last_name
    email
  }
}
```

## Performance Indexes

All critical queries are indexed:
- `clients(user_id)` - Filter by owner
- `appointments(user_id, start_time)` - Date range queries
- `pets(client_id)` - Client's pets lookup
- `weather_cache(latitude, longitude, forecast_date)` - Weather lookups

## Backup & Restore

### Backup Schema
```bash
pg_dump -h localhost -U postgres -d ke_agenda --schema-only > schema_backup.sql
```

### Backup Data
```bash
pg_dump -h localhost -U postgres -d ke_agenda --data-only > data_backup.sql
```

## Troubleshooting

### Connection Issues
```bash
# Test PostgreSQL connection
psql -h localhost -U postgres -d ke_agenda -c "SELECT version();"

# Check Hasura logs
docker logs ke-agenda-hasura
```

### Permission Errors
- Verify JWT token includes correct claims
- Check `X-Hasura-User-Id` matches data owner
- Confirm row-level security rules in `permissions.yaml`

## Production Considerations

1. **Change admin secret** - Use strong random value
2. **Enable SSL** - Configure `DATABASE_URL` with SSL
3. **Rate limiting** - Enable in Hasura Cloud or reverse proxy
4. **Monitoring** - Set up health checks and alerts
5. **Backup strategy** - Automated daily backups
6. **JWT secret rotation** - Plan for key rotation

## References

- [Hasura Docs](https://hasura.io/docs/latest/)
- [Better Auth JWT](https://better-auth.com)
- [PostgreSQL 15](https://www.postgresql.org/docs/15/)
