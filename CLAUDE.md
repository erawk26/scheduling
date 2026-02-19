# KE Agenda V3 - AI Assistant Context

> **CRITICAL**: This file provides essential context for AI assistants. Read this FIRST before any work.

## Project Overview

**What**: Local-first scheduling platform for mobile service professionals
**Why**: Solve iOS PWA limitations with offline-first architecture
**Who**: Pet groomers, dog trainers, music teachers (185,000+ professionals)
**How**: SQLite WASM + PostgreSQL with transparent sync

### Core Innovation
1. **Weather-integrated scheduling** - Proactive rescheduling
2. **Route optimization** - Save 25% drive time
3. **72+ hour offline** - Full functionality without internet
4. **Zero vendor lock-in** - Own your data

---

## Mandatory Reading Order

Before touching ANY code, read these documents in order:

1. **[AI_GUARDRAILS.md](./docs/AI_GUARDRAILS.md)** - CRITICAL rules you MUST follow
2. **[tech_requirements_guide.md](./docs/tech_requirements_guide.md)** - The ONLY source of truth
3. **[HIVE_PROJECT_PLAN.md](./docs/HIVE_PROJECT_PLAN.md)** - Development roadmap

---

## Current Project State

### Completed
- Technical requirements defined
- Architecture decisions locked
- Database schema designed (SQLite WASM + Kysely)
- Project plan created
- Next.js 15 project initialized
- Better Auth integration (sign-in, sign-up, sign-out)
- SQLite WASM setup with Kysely query builder
- Base UI components (shadcn/ui)
- Dashboard with live stats (appointments, clients, services, revenue)
- Services CRUD (create, edit, delete with validation)
- Clients CRUD with pet management (nested pets per client)
- Appointments CRUD with scheduling (date/time picker, service/client selection, auto-duration)
- Settings page (profile, notifications, business hours)
- TanStack Query hooks for all entities

### In Progress
- Calendar interface (visual calendar view)
- Weather integration (Tomorrow.io API)
- Route optimization (Google Maps)
- PostgreSQL + Hasura sync engine
- PWA setup

### Not Started
- Offline sync queue with conflict resolution
- Push notifications
- Route optimization UI
- Production deployment

---

## Tech Stack (LOCKED - NEVER SUBSTITUTE)

```yaml
MUST USE:
- Better Auth (NOT Supabase/Clerk)
- PostgreSQL + Hasura (NOT Supabase)
- SQLite WASM + Kysely (NOT Prisma)
- graphql-request (NOT Apollo)
- TanStack Query (NOT SWR)
- React Hook Form + Zod
- date-fns (NOT moment)
- pnpm (package manager)
- shadcn/ui + Tailwind CSS v4

NEVER USE:
- Supabase anything
- Clerk Auth / Firebase
- Prisma ORM / Apollo Client
- Redux / MobX
- Moment.js / Lodash
```

---

## Architecture Rules

1. **EVERY operation is local-first** - SQLite before network
2. **NEVER block on network** - Queue and retry
3. **Functions < 50 lines** - Clean code enforced
4. **This is LOCAL-FIRST** (not just offline-first) - Performance matters (<200ms always)
5. **Simple > Clever** - Boring technology > Cutting edge

---

## Project Structure

```
ke-agenda-v2/
├── src/
│   ├── app/                  # Next.js 15 App Router
│   │   ├── (auth)/           # Sign-in, sign-up pages
│   │   └── dashboard/        # Main app pages
│   │       ├── appointments/
│   │       ├── clients/      # Includes [id]/ detail page
│   │       ├── services/
│   │       ├── settings/
│   │       ├── routes/
│   │       └── weather/
│   ├── components/
│   │   ├── layout/           # Header, Sidebar
│   │   └── ui/               # shadcn/ui primitives
│   ├── hooks/                # TanStack Query hooks (use-clients, use-services, etc.)
│   ├── lib/
│   │   ├── auth.ts           # Better Auth config
│   │   ├── database/         # SQLite WASM + Kysely schema & operations
│   │   └── validations/      # Zod schemas for all forms
│   ├── providers/            # Auth, Database, Query providers
│   └── types/                # TypeScript types
├── docs/
│   ├── AI_GUARDRAILS.md
│   ├── tech_requirements_guide.md
│   ├── HIVE_PROJECT_PLAN.md
│   └── design/               # Design system docs
└── public/                   # Static assets
```

---

## Development Workflow

### Package Manager
This project uses **pnpm**. All commands use `pnpm`:
```bash
pnpm install          # Install dependencies
pnpm dev              # Start development server
pnpm build            # Production build
pnpm test             # Run tests
pnpm lint             # Lint check
```

### Before Writing Code
1. Read the guardrails (AI_GUARDRAILS.md)
2. Check tech requirements - no substitutions allowed
3. Verify offline-first - must work without internet

### Code Standards
- Functions < 50 lines, single responsibility
- No `any` type, no magic numbers
- No `console.log` left in production code
- Handle errors gracefully, never block on network
- Use skeletons for loading states (never spinners for local ops)
- Minimum 44px touch targets for mobile
- Proper ARIA labels for accessibility

### Git Workflow
```bash
# Branch naming
feature/calendar-ui
fix/sync-queue-retry

# Commit messages (conventional commits)
feat: Add appointment creation with offline support
fix: Handle sync conflicts with last-write-wins
```

---

## Known Patterns

### DateTime Handling
- Store datetimes as local ISO strings WITHOUT timezone suffix (no `.000Z`)
- Use `format(date, "yyyy-MM-dd'T'HH:mm:ss")` for constructing form values
- Use `parseISO()` from date-fns for parsing stored datetime strings
- Form datetime inputs: combine date + time as `${date}T${time}:00`

### Price Handling
- Store prices as `price_cents` (integer) in the database
- Display as dollars: `(price_cents / 100).toFixed(2)`
- In forms, use a controlled `priceDisplay` state - do NOT use `register()` with custom `onChange`

### React Hook Form + Radix/shadcn
- Never spread `register()` on inputs that also need custom `onChange` or `value` - they conflict
- For controlled components (Select, Switch, custom inputs), use `form.watch()` + `form.setValue()`

### Auth
- `TEMP_USER_ID = 'local-user'` is used across all CRUD hooks until full auth sync is implemented
- Auth session available via `useAuth()` from `@/providers/auth-provider`

---

## Design System

Refer to `/docs/design/` for full specifications:
- **Design system**: `/docs/design/design-system.md` - colors, spacing, typography
- **Components**: `/docs/design/component-library.md` - existing patterns
- **UI patterns**: `/docs/design/ui-patterns.md` - responsiveness, interactions

When making UI changes, follow the design system documentation and use shadcn/ui components from `@/components/ui/`.

---

## Performance Targets

| Metric | Target |
|--------|--------|
| Local operations | <200ms |
| Sync success rate | >99.5% |
| Offline duration | 72+ hours |
| Bundle size | <450KB |
| Route optimization | <5s for 20 stops |

---

## Quick Decision Guide

```
Is it in tech_requirements_guide.md?
  YES -> Use exactly as specified
  NO  -> Does it require a new dependency?
           YES -> Get approval first
           NO  -> Will it work offline for 72+ hours?
                    NO  -> Redesign for local-first
                    YES -> Does it add vendor lock-in?
                             YES -> Find portable solution
                             NO  -> Proceed with implementation
```

---

## Key Documentation Links

### Internal
- [AI Guardrails](./docs/AI_GUARDRAILS.md) - MUST READ
- [Tech Requirements](./docs/tech_requirements_guide.md) - Source of truth
- [Project Plan](./docs/HIVE_PROJECT_PLAN.md) - Development roadmap
- [User Stories](./docs/user_stories_acceptance_criteria.md) - Feature specs

### External
- [Better Auth](https://better-auth.com) - Authentication
- [Kysely](https://kysely.dev) - Database queries
- [Hasura](https://hasura.io/docs) - GraphQL engine
- [SQLite WASM](https://sqlite.org/wasm) - Local database
- [TanStack Query](https://tanstack.com/query) - Data fetching

---

**Project Version**: 3.0.0
**Last Updated**: February 2026
**Status**: Foundation phase - CRUD complete, sync and advanced features in progress
