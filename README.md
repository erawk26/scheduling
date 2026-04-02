# KE Agenda V3

Local-first scheduling platform for mobile service professionals.

## Quick Start

```bash
# Install dependencies (first time only)
npm install

# Start everything (database + dev server)
./dev.sh

# Stop everything
./stop.sh
```

That's it! The app will be running at http://localhost:3025

## What `./dev.sh` Does

1. Starts PostgreSQL + Hasura in Docker
2. Runs database migrations (if needed)
3. Starts Next.js dev server

## Manual Commands

If you prefer to run things separately:

```bash
# Start database services
cd hasura && docker-compose up -d && cd ..

# Start dev server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

## Requirements

- Node.js 20+
- Docker
- npm 10+

## Architecture

- **Frontend**: Next.js 15 + React 19
- **Local DB**: SQLite WASM + Kysely
- **Server DB**: PostgreSQL + Hasura GraphQL
- **Auth**: Better Auth
- **UI**: Tailwind CSS v4 + shadcn/ui

## Documentation

- [Technical Requirements](./docs/tech_requirements_guide.md)
- [AI Guardrails](./docs/AI_GUARDRAILS.md)
- [Project Plan](./docs/HIVE_PROJECT_PLAN.md)
