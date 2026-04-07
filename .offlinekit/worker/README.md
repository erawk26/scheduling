# ke-agenda-sync — Cloudflare Worker

Sync server for localkit (`@erawk26/localkit`). Implements the push/pull protocol so data syncs across browsers/devices.

## Routes

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/sync/push` | Store local changes on the server |
| `GET` | `/sync/pull?since=<epoch_ms>` | Return all changes newer than cursor |
| `GET` | `/` | Health check |

Auth: `Authorization: Bearer <better-auth-token>` — the worker validates the token by calling your app's `/api/auth/get-session`.

## First-time setup

### 1. Install dependencies

```bash
cd .offlinekit/worker
npm install   # or pnpm install
```

### 2. Create the D1 database

```bash
npx wrangler d1 create ke-agenda-sync
```

Copy the `database_id` from the output and paste it into `wrangler.toml`:

```toml
[[d1_databases]]
database_id = "PASTE_ID_HERE"
```

### 3. Apply the schema

```bash
# Local dev
npm run db:migrate

# Production
npm run db:migrate:remote
```

### 4. Set secrets

```bash
npx wrangler secret put BETTER_AUTH_URL
# Enter your production app URL, e.g. https://app.yourdomain.com
```

### 5. Deploy

```bash
npm run deploy
```

The worker URL (e.g. `https://ke-agenda-sync.<your-subdomain>.workers.dev`) is the value to set for `NEXT_PUBLIC_OFFLINEKIT_SYNC_ENDPOINT` in your app's `.env.local`.

**Important:** set the env var to the worker base URL — no trailing slash, no `/sync` suffix:

```env
NEXT_PUBLIC_OFFLINEKIT_SYNC_ENDPOINT=https://ke-agenda-sync.<your-subdomain>.workers.dev
```

## Local development

```bash
npm run dev
# Worker runs at http://localhost:8787
# App default (NEXT_PUBLIC_OFFLINEKIT_SYNC_ENDPOINT not set) points here automatically
```

## Storage

Uses Cloudflare D1 (SQLite). Schema in `schema.sql`. Each document row is keyed by `(user_id, collection, id)`. Last-write-wins: an incoming change only overwrites if its `updated_at` is newer than what's stored.
