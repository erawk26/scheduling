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
- Better Auth integration (sign-in, sign-up, sign-out, email verification)
- SQLite WASM setup with Kysely query builder
- Base UI components (shadcn/ui)
- Dashboard with live stats (appointments, clients, services, revenue)
- Services CRUD (create, edit, delete with validation)
- Clients CRUD with pet management (nested pets per client)
- Appointments CRUD with scheduling (date/time picker, service/client selection, auto-duration)
- Calendar view - Day/Week/Month views with time grid, appointment pills, weather icons, keyboard accessibility
- Settings page (profile, notifications, business hours)
- TanStack Query hooks for all entities
- Weather integration (Tomorrow.io API) - 5-day forecast, current conditions, outdoor suitability, appointment alerts
- Route optimization (GraphHopper VRP) - real road-distance optimization with Haversine offline fallback
- Route optimization UI - Leaflet/OpenStreetMap map, numbered stops, polyline routes, credit tracking
- Geocoding integration - auto address-to-coordinates on client/appointment save
- Schedule Intelligence - route efficiency analysis, recurring appointment detection, weekly schedule suggestions
- Client scheduling flexibility (unknown/flexible/fixed) with UI badges and edit form
- Client portal (basic) - client sign-in, view upcoming appointments, cancel appointments
- PWA setup - service worker (app shell + WASM + static caching), manifest, offline fallback page, background sync
- Local-first infrastructure - OPFS persistence, sync queue, incremental pull
- Middleware - cookie-based auth route protection for dashboard
- Mobile sidebar - responsive navigation with sheet component
- Production deployment config - Dockerfile, docker-compose, env validation

### In Progress
- PostgreSQL + Hasura sync engine (GraphQL client, mutations, queries exist; backend wiring incomplete)

### Not Started
- Push notifications

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
- GraphHopper API (route optimization + geocoding)
- Leaflet + react-leaflet (map visualization, OSM tiles)
- Tomorrow.io API (weather forecasts)

NEVER USE:
- Supabase anything
- Clerk Auth / Firebase
- Prisma ORM / Apollo Client
- Redux / MobX
- Moment.js / Lodash
- Google Maps API (use GraphHopper instead)
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
│   │   ├── (auth)/           # Sign-in, sign-up, verify-email
│   │   ├── api/              # Server-side API routes
│   │   │   ├── auth/         # Better Auth catch-all
│   │   │   ├── credits/      # GraphHopper credit check
│   │   │   ├── geocode/      # Address-to-coords proxy
│   │   │   ├── portal/       # Client portal endpoints
│   │   │   ├── routes/       # VRP optimization proxy
│   │   │   ├── schedule/     # Schedule suggestion engine
│   │   │   └── weather/      # Tomorrow.io forecast proxy
│   │   ├── dashboard/        # Main app pages
│   │   │   ├── appointments/
│   │   │   ├── clients/      # Includes [id]/ detail page
│   │   │   ├── services/
│   │   │   ├── settings/
│   │   │   ├── routes/
│   │   │   ├── schedule-intelligence/  # Smart Schedule dashboard
│   │   │   └── weather/
│   │   ├── offline/          # Offline fallback page
│   │   └── portal/           # Client-facing portal (sign-in, appointments)
│   ├── components/
│   │   ├── appointments/     # Calendar view, weather badge
│   │   ├── layout/           # Header, Sidebar, Mobile sidebar
│   │   ├── routes/           # Route map (Leaflet)
│   │   ├── schedule-intelligence/  # Efficiency & suggestion cards
│   │   └── ui/               # shadcn/ui primitives
│   ├── hooks/                # TanStack Query hooks (use-clients, use-services, etc.)
│   ├── lib/
│   │   ├── auth.ts           # Better Auth server config
│   │   ├── auth-client.ts    # Better Auth client
│   │   ├── database/         # SQLite WASM + Kysely schema & operations
│   │   ├── graphhopper/      # GraphHopper API client, geocoding, VRP optimization
│   │   ├── graphql/          # Hasura GraphQL client, queries & mutations
│   │   ├── routes/           # Local Haversine optimizer (offline fallback)
│   │   ├── schedule-intelligence/  # Analyzer, recurrence, suggester
│   │   ├── weather/          # Tomorrow.io weather types & service
│   │   └── validations/      # Zod schemas for all forms
│   ├── middleware.ts          # Auth route protection (cookie check)
│   ├── providers/            # Auth, Database, Query providers
│   └── types/                # TypeScript types
├── docs/
│   ├── AI_GUARDRAILS.md
│   ├── tech_requirements_guide.md
│   ├── HIVE_PROJECT_PLAN.md
│   └── design/               # Design system docs
├── public/
│   ├── sw.js                 # Service worker (app shell, WASM, offline)
│   └── manifest.json         # PWA manifest
├── Dockerfile                # Production container
└── docker-compose.prod.yml   # Production orchestration
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

### Route Optimization (GraphHopper)
- **API key**: Server-side only via `GRAPHHOPPER_API_KEY` env var, never exposed to client
- **Geocoding**: Auto-fires on client/appointment create/update (fire-and-forget, non-blocking)
- **VRP optimization**: Called via `/api/routes/optimize` API route, falls back to local Haversine if offline or API fails
- **Rate limiting**: 1 req/sec queue, in-memory LRU cache (geocode permanent, VRP 1hr TTL)
- **Credit tracking**: 500 credits/day free tier, warning at 80%, hard-stop at 95%, auto-fallback to local
- **Map**: Leaflet + OpenStreetMap, dynamically imported with `ssr: false`, polyline from VRP or straight-line fallback
- **Key files**: `src/lib/graphhopper/` (client, types, rate-limiter, cache, credit-tracker, geocode, optimize)

### Weather Integration (Tomorrow.io)
- **API key**: Server-side only via `TOMORROW_IO_API_KEY` env var, proxied through `/api/weather/forecast`
- **Forecasts**: 5-day daily forecasts aggregated from hourly timeline (high/low/avg temps, precip, wind)
- **Outdoor suitability**: `precip_probability < 40 && wind_speed < 20 && temp >= 32 && temp <= 95`
- **Weather codes**: 1000=Clear through 8000=Thunderstorm, mapped to condition labels and lucide icons
- **Caching**: 30-min stale time in TanStack Query, `Cache-Control: s-maxage=1800` on API route
- **Weather badges**: Amber alerts on weather-dependent appointments, calendar day cells get weather icons
- **Location fallback chain**: Client coordinates -> business location -> browser geolocation
- **Key files**: `src/lib/weather/` (types, service), `src/hooks/use-weather.ts`, `src/components/appointments/weather-badge.tsx`

### Calendar View
- **Views**: Day, Week, Month with keyboard navigation (arrow keys, Escape)
- **Time grid**: Day/Week views show 6am-9pm hourly grid with appointment pills positioned by time
- **Month grid**: Standard calendar grid with appointment dots and day selection
- **Weather icons**: Day cells show weather alert icons when forecast is bad for outdoor services
- **Navigation**: Previous/Next/Today buttons, view mode tabs
- **Key files**: `src/components/appointments/calendar-view.tsx`, used in `src/app/dashboard/appointments/page.tsx`

### Client Portal
- **Separate auth**: Uses `portal-auth-client.ts` (not the main Better Auth client)
- **Routes**: `/portal/sign-in`, `/portal/appointments` - client-facing, read-only with cancel
- **API**: `/api/portal/appointments` (list), `/api/portal/appointments/[id]/status` (cancel)
- **Key files**: `src/app/portal/`, `src/lib/portal-auth-client.ts`

### Schedule Intelligence
- **Analyzer**: Compares actual route distance (scheduled order) vs optimal (nearest-neighbor) per day
- **Efficiency score**: `(optimal / actual) * 100`, capped at 100%. Average speed assumed: 40 km/h for time estimates
- **Recurrence detection**: Groups by `clientId::serviceId`, requires 3+ occurrences in 4 weeks on similar day
- **Suggestions**: Reorders flexible/unknown appointments via optimizer, chains time slots with 15min travel buffer
- **Client flexibility**: `scheduling_flexibility` column on clients table ('unknown' | 'flexible' | 'fixed')
- **UI**: `/dashboard/schedule-intelligence` with "Last Week" analysis tab and "Next Week" suggestions tab
- **Apply flow**: One-click apply per suggestion or batch "Apply All", with undo (restores original times)
- **Key files**: `src/lib/schedule-intelligence/` (analyzer, recurrence, suggester, types)

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
- [GraphHopper](https://docs.graphhopper.com/) - Route optimization & geocoding
- [Leaflet](https://leafletjs.com/) - Map visualization
- [Tomorrow.io](https://docs.tomorrow.io/) - Weather forecasts

---

**Project Version**: 3.0.0
**Last Updated**: February 2026
**Status**: Feature-rich phase - CRUD, calendar, weather, routes, schedule intelligence, client portal, PWA complete. Hasura sync in progress.
