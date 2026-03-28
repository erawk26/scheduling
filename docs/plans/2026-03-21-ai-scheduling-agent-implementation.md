# AI Scheduling Agent - Implementation Plan (v2)

> **Date:** 2026-03-21
> **Revised:** 2026-03-21 (Architect + Critic feedback incorporated)
> **Source:** docs/plans/2026-03-21-ai-scheduling-agent-design.md
> **Type:** Fork of KE Agenda V3 (agent-first rebuild, not a bolt-on)
> **Branch:** `feature/agent-rebuild` (long-lived feature branch off `main`)
> **Data Strategy:** Greenfield. No migration from existing SQLite data. New OfflineKit collections start empty. Existing KE Agenda V3 users are not expected to carry data forward -- this is a new product fork.
> **Status:** PARTIALLY SUPERSEDED
>
> **2026-03-28 UPDATE:** All OpenViking-related tasks (Task 2.1 OpenVikingContextProvider, hydration pipeline, HTTP client, etc.) are replaced by the Tiered L0/L1/L2 MiniSearch BM25 architecture. See `.omc/plans/phase-2-chat-tdd.md` for the approved replacement plan. Reason: OpenViking (Python) cannot run on mobile PWA target devices; server-side deployment breaks OfflineKit's encryption-at-rest privacy model. Non-OpenViking tasks in this plan (chat UI, bootstrap, skills, OfflineKit collections) remain valid.

---

## RALPLAN-DR Summary

### Principles

1. **Agent is the product, UI is the review layer.** Every feature decision should ask: "Does the agent drive this, or does the user manually operate it?" Default to agent-driven.
2. **OfflineKit is the single source of truth.** No second storage layer. Context retrieval queries OfflineKit directly. Data flows one direction.
3. **Incremental value delivery.** Each phase produces a usable (if incomplete) product. No "6 weeks of infrastructure before anything works."
4. **Preserve what works, replace what's obsolete.** Weather, route optimization, calendar/map views carry over conceptually. SQLite/Kysely/Hasura are fully replaced by OfflineKit for data storage/sync. **Better Auth is preserved** via mpb-localkit's `BetterAuthAdapter` (`type: "better-auth"`) — OfflineKit handles data, Better Auth handles authentication. They coexist.
5. **Context provider is swappable, OpenViking is primary.** The agent's context assembly layer uses a `ContextProvider` interface. Ships with `OpenVikingContextProvider` (semantic retrieval, tiered L0/L1/L2 loading, self-iterating memory via embedded Python/HTTP server). `StructuredContextProvider` (OfflineKit queries) exists as a lightweight fallback.

### Decision Drivers (Top 3)

1. **OfflineKit migration is the foundation.** Nothing else works until business data lives in OfflineKit collections with working CRUD and sync. This is the critical path gate.
2. **Agent reasoning loop is the core differentiator.** The OpenRouter integration + context retrieval is what makes this product different from a scheduling app. Must be proven early (Phase 2).
3. **Client outreach (email + booking page) is the revenue unlock.** Without "pick a slot" booking links, the agent can build schedules but cannot confirm them with clients.

### Viable Options

#### Option A: Foundation-First (Recommended)

Sequence: OfflineKit migration -> Agent core (reasoning + context) -> Client communication -> External chat bridge

**Pros:**
- Each phase builds on a stable foundation
- Agent reasoning can be tested with real data from Phase 1
- Client communication is self-contained (email + booking page, no platform dependencies)
- External messaging is the riskiest integration; deferring it reduces early risk

**Cons:**
- Users must use in-app chat until Phase 5 (no iMessage/WhatsApp)
- Longer time to the "full vision" of messaging-first interaction

#### Option B: Chat-Bridge-First

Sequence: External messaging bridge -> Agent core -> OfflineKit migration -> Client communication

**Pros:**
- Proves the messaging-first UX thesis early

**Cons (invalidation rationale):**
- Messaging platform integration is the highest-risk, least-defined piece
- Agent has no data to reason about until OfflineKit collections exist
- Building a messaging bridge before the agent backend exists means building a bridge to nothing
- Twilio/MessageBird evaluation adds external dependency research before any product progress

**Verdict:** Option B is invalidated because the agent needs data to reason about. Option A is the clear path.

---

## Context

### What Exists (KE Agenda V3)

- Full CRUD for clients, appointments, services, pets (SQLite WASM + Kysely)
- Calendar view (day/week/month), weather integration (Tomorrow.io), route optimization (GraphHopper)
- Schedule intelligence (analyzer, recurrence detection, suggester)
- Client portal, PWA with service worker, Better Auth
- TanStack Query hooks for all entities + API calls
- Zod validation schemas
- shadcn/ui component library

### Complete Hook Inventory (17 files) + Migration Disposition

| Hook File | Depends On | Disposition | Rationale |
|-----------|-----------|-------------|-----------|
| `use-clients.ts` | DB + TanStack Query | **MIGRATE** | Replace with OfflineKit `useCollection(app.clients)` |
| `use-appointments.ts` | DB + TanStack Query | **MIGRATE** | Replace with OfflineKit `useCollection(app.appointments)` |
| `use-services.ts` | DB + TanStack Query | **MIGRATE** | Replace with OfflineKit `useCollection(app.services)` |
| `use-pets.ts` | DB + TanStack Query | **MIGRATE** | Replace with OfflineKit `useCollection(app.pets)` |
| `use-business-location.ts` | DB + TanStack Query (`users` table) | **MIGRATE** | Reads `business_latitude`/`business_longitude` from `users`. Migrate to read from `businessProfile` collection (see Users Collection below) |
| `use-geocode.ts` | DB (direct Kysely writes) | **MIGRATE** | Rewrite to use OfflineKit `update()` on `clients`/`appointments` collections. Keep GraphHopper geocode call. |
| `use-routes.ts` | DB + TanStack Query + GraphHopper | **MIGRATE** | Reads appointments+clients+services from DB, calls GraphHopper. Replace DB reads with OfflineKit queries. Keep GraphHopper integration and TanStack Query for the API call caching. |
| `use-schedule-analysis.ts` | DB + TanStack Query | **REMOVE** | Logic absorbed into agent `report` skill. Dashboard page removed in Phase 1. |
| `use-schedule-suggestions.ts` | DB + TanStack Query | **REMOVE** | Logic absorbed into agent `build-schedule` skill. Dashboard page removed in Phase 1. Includes `useApplySuggestion`, `useApplyAllSuggestions`, `useUndoSuggestion`. |
| `use-mock-data.ts` | DB + TanStack Query | **REMOVE** | Development utility. Not needed in agent fork. |
| `use-initial-data-pull.ts` | DB + TanStack Query + GraphQL/Hasura | **REMOVE** | Hasura sync replaced by OfflineKit sync. Greenfield = no data migration. |
| `use-session.ts` | TanStack Query + Better Auth API | **REMOVE** | Replaced by `useAuth()` from auth provider backed by mpb-localkit's BetterAuthAdapter. |
| `use-user-id.ts` | Auth provider | **MIGRATE** | Rewrite to use OfflineKit `useAuth()` hook. Thin wrapper: `app.auth.currentUser?.id ?? null`. |
| `use-weather.ts` | TanStack Query (API call only) | **KEEP** | Fetches from `/api/weather/forecast`. No DB dependency. TanStack Query provides API response caching (30min stale). Keep as-is. |
| `use-network-status.ts` | Browser APIs only | **KEEP** | Pure browser `navigator.onLine` listener. No DB dependency. Keep as-is. |
| `use-user-location.ts` | Browser APIs only | **KEEP** | Browser geolocation + localStorage cache. No DB dependency. Keep as-is. |
| `use-toast.ts` | React state only | **KEEP** | Pure UI state hook. No dependencies. Keep as-is. |
| `AGENTS.md` | (not a hook) | **REMOVE** | OMC agent config file in hooks dir, not application code |

### TanStack Query Fate

**TanStack Query stays for non-DB hooks.** It is removed from all database CRUD hooks (replaced by OfflineKit's reactive `useCollection`), but retained for:
- `use-weather.ts` -- caches Tomorrow.io API responses (30min stale time)
- `use-routes.ts` -- caches GraphHopper VRP API responses
- Any future server API call hooks (OpenRouter response caching, etc.)

OfflineKit's `useCollection` handles reactive local data. TanStack Query handles server API response caching. They serve different purposes and coexist cleanly.

### Users Table / Business Profile Collection

The current `UsersTable` contains: `business_name`, `phone`, `timezone`, `service_area_miles`, `business_latitude`, `business_longitude`. These fields are used by:
- Settings page (profile editing)
- `use-business-location.ts` (weather location fallback)
- `use-initial-data-pull.ts` (user bootstrapping)

**Decision:** Create a `businessProfile` collection in OfflineKit (one document per user) containing these fields. This is separate from `agentProfile` (which holds the 7 onboarding sections). Rationale: business profile is user-edited settings data; agent profile is agent-populated scheduling intelligence data. They have different access patterns and edit flows.

### What Gets Replaced

- `src/lib/database/` (SQLite WASM + Kysely) -> OfflineKit collections
- `src/providers/database-provider.tsx` -> OfflineKit React provider
- `src/providers/auth-provider.tsx` -> OfflineKit auth hooks
- `src/lib/auth.ts` + `src/lib/auth-client.ts` (Better Auth) -> Keep and adapt. Better Auth server stays, mpb-localkit uses `BetterAuthAdapter` to connect to it.
- `src/lib/graphql/` (Hasura) -> removed entirely (OfflineKit syncs to Cloudflare)
- `src/lib/database/sync-engine.ts` -> OfflineKit sync engine
- DB-dependent TanStack Query hooks -> OfflineKit `useCollection` hooks
- `src/app/portal/` (client portal) -> replaced by booking page

### What Gets Kept (adapted)

- `src/lib/weather/` (Tomorrow.io integration) - keep as-is, agent uses it
- `src/lib/graphhopper/` (route optimization, geocoding) - keep as-is, agent uses it
- `src/lib/schedule-intelligence/` (analyzer, recurrence, suggester) - absorb into agent skills
- `src/components/appointments/calendar-view.tsx` - keep for schedule review UI
- `src/components/routes/` (Leaflet map) - keep for route review UI
- `src/components/ui/` (shadcn primitives) - keep entirely
- `src/lib/validations/` (Zod schemas) - adapt for OfflineKit collection schemas
- `use-weather.ts`, `use-network-status.ts`, `use-user-location.ts`, `use-toast.ts` - keep as-is

### What's New

- OfflineKit app configuration + collection schemas (including `businessProfile`)
- ContextProvider interface with OpenVikingContextProvider as primary (embedded Python/HTTP server)
- StructuredContextProvider as lightweight fallback (OfflineKit queries)
- OpenRouter integration (LLM reasoning)
- Agent backend (skill execution engine, context assembly)
- Agent chat UI (in-app, bridged to external later)
- Onboarding form (7 sections, agent-populated)
- Booking page (public, no auth, "pick a slot")
- Transactional email sending
- Agent collections: `agentNotes`, `agentProfile` (7 per-section docs), `agentMemories`, `agentConversations`

---

## Guardrails

### Must Have

- All data in OfflineKit collections (no SQLite WASM, no Kysely, no Hasura)
- Better Auth via mpb-localkit's BetterAuthAdapter (`type: "better-auth"`, `bearer()` plugin required)
- Agent reasoning via OpenRouter (model-agnostic)
- OpenViking for agent context (embedded mode or local HTTP server)
- Works offline (OfflineKit handles this)
- Mobile-friendly PWA
- pnpm, Next.js, React, shadcn/ui, Tailwind CSS
- Service worker updated in Phase 1 (no stale WASM cache references)
- Token budget / cost controls for OpenRouter calls
- PII level declarations on skill definitions

### Must NOT Have

- SQLite WASM, Kysely, PostgreSQL, Hasura (all replaced by OfflineKit for data)
- Custom auth implementations (Better Auth stays, accessed via mpb-localkit BetterAuthAdapter)
- Apollo Client, Prisma, Supabase, Clerk, Firebase
- Any semantic search SDK other than OpenViking without explicit approval
- Direct LLM calls without context assembly (always use OpenViking for context)
- Client PII sent to OpenRouter when avoidable (use anonymization per design doc)
- Blocking network calls in the UI (OfflineKit is local-first by design)

---

## Phase 1: OfflineKit Foundation + Service Worker Update

**Goal:** Replace the entire storage/auth/sync layer with OfflineKit. App boots, authenticates, and performs CRUD on all business entities via OfflineKit. Service worker cleaned up.

### Task 1.1: OfflineKit App Bootstrap

- Install `mpb-localkit` (the published package name)
- Create `src/lib/offlinekit/schema.ts` defining all collections with Zod schemas:
  - `clients` (migrate fields from `ClientsTable`)
  - `appointments` (migrate fields from `AppointmentsTable`)
  - `services` (migrate fields from `ServicesTable`)
  - `pets` (migrate fields from `PetsTable`)
  - `businessProfile` (one doc per user: `business_name`, `phone`, `timezone`, `service_area_miles`, `business_latitude`, `business_longitude`)
  - `agentNotes` (new - weekly accumulated notes)
  - `agentProfile` (new - 7 per-section documents, keyed by section ID: `work-schedule`, `service-area`, `travel-rules`, `client-rules`, `personal-commitments`, `business-rules`, `priorities`)
  - `agentMemories` (new - learned patterns)
  - `agentConversations` (new - chat history)
- Configure `createApp()` with sync endpoint (Cloudflare Workers)
- **Acceptance:** `createApp()` returns typed app instance. `pnpm build` succeeds. All collection schemas validate with Zod.

### Task 1.2: Auth Migration

- Keep Better Auth (`src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...auth]/route.ts`)
- Configure mpb-localkit with `auth: { type: 'better-auth', baseURL: '...' }` to use BetterAuthAdapter
- Better Auth server needs `bearer()` plugin for mpb-localkit token-based auth
- Update `src/providers/auth-provider.tsx` to use `app.auth` from mpb-localkit (which delegates to Better Auth)
- Create `src/providers/offlinekit-provider.tsx` exposing app instance via context
- Update sign-in/sign-up pages to use auth provider (which uses mpb-localkit -> Better Auth)
- Middleware checks Better Auth session cookie for route protection
- Rewrite `use-user-id.ts` to use `app.auth.currentUser()` from mpb-localkit's BetterAuthAdapter
- **Acceptance:** User can sign up, sign in, sign out via Better Auth. Session persists offline via cached token. Protected routes work. `useUserId()` returns the Better Auth user ID.

### Task 1.3: CRUD Hook Migration

Replace DB-dependent hooks per the disposition table above:

**MIGRATE (7 hooks):**
- `use-clients.ts` -> `useCollection(app.clients)` with OfflineKit reactive queries
- `use-appointments.ts` -> `useCollection(app.appointments)` with OfflineKit reactive queries
- `use-services.ts` -> `useCollection(app.services)` with OfflineKit reactive queries
- `use-pets.ts` -> `useCollection(app.pets)` with OfflineKit reactive queries
- `use-business-location.ts` -> reads from `useCollection(app.businessProfile)` filtered by user ID
- `use-geocode.ts` -> rewrite to call OfflineKit `update()` on clients/appointments. Keep GraphHopper geocode call unchanged.
- `use-routes.ts` -> replace DB reads with OfflineKit collection queries. Keep TanStack Query wrapper for GraphHopper API caching. Keep local Haversine fallback.

**REMOVE (5 hooks):**
- `use-initial-data-pull.ts` (OfflineKit sync replaces Hasura pull; greenfield = no migration)
- `use-session.ts` (replaced by `app.auth` from mpb-localkit's BetterAuthAdapter via auth provider)
- `use-mock-data.ts` (development utility, not needed)
- `use-schedule-analysis.ts` (logic absorbed into agent report skill)
- `use-schedule-suggestions.ts` (logic absorbed into agent build-schedule skill)

**KEEP (4 hooks, unchanged):**
- `use-weather.ts`, `use-network-status.ts`, `use-user-location.ts`, `use-toast.ts`

Remove `src/providers/database-provider.tsx` and `src/lib/database/` entirely.
Remove `src/lib/graphql/` entirely.
Update all dashboard pages to use new hooks.

- **Acceptance:** All CRUD operations work (create, read, update, delete) for clients, services, appointments, pets. Business profile reads/writes work. Data persists across page reloads. Offline writes sync when online. Zero references to removed modules. `pnpm build` succeeds.

### Task 1.4: Service Worker Update

- Remove `WASM_CACHE` constant and all WASM-specific caching logic from `public/sw.js`
- Remove `.wasm` from `STATIC_EXTENSIONS` regex
- Update `APP_SHELL` to reflect new route structure (remove `/dashboard/routes`, `/dashboard/weather` if pages are simplified; add `/dashboard/chat` placeholder)
- Bump cache version to force re-install
- **Acceptance:** Service worker installs cleanly. No console errors about missing WASM assets. Offline fallback page works. App shell caching works for new routes.

### Task 1.5: UI Cleanup Pass

- Remove client portal (`src/app/portal/`, `src/lib/portal-auth-client.ts`, `src/app/api/portal/`)
- Remove schedule intelligence dashboard pages (logic preserved in `src/lib/schedule-intelligence/` for Phase 2 agent skills)
- Remove manual appointment CRUD as primary flow (keep as override in calendar view)
- Simplify dashboard: calendar view, client list, settings
- Remove TanStack Query provider if no remaining hooks use it (but weather + routes still do, so **keep QueryClientProvider**)
- **Acceptance:** App is clean, no dead imports, no references to removed modules. `pnpm build` succeeds with zero errors.

### Task 1.6: Deploy OfflineKit Worker

- Run `npx mpb-localkit build --name ke-agent` to generate Cloudflare Worker
- Configure sync transport (auto: WebSocket with HTTP fallback)
- Deploy worker, verify multi-device sync
- **Acceptance:** Data syncs between two browser tabs. Worker deployed to Cloudflare.

### Phase 1 Testing

- **Unit tests:** OfflineKit schema validation (Zod schemas accept valid data, reject invalid). Auth flow unit tests (sign-in, sign-up, sign-out state transitions).
- **Integration tests:** CRUD round-trip for each collection (create -> read -> update -> delete). Geocode hook fires on client create with address. Business profile reads return correct data.
- **Manual smoke tests:** Sign up fresh account. Create client, service, appointment. Verify calendar view renders. Go offline, create a client, come back online, verify sync. Open two tabs, verify cross-tab sync.
- **Tools:** Vitest for unit/integration. Manual testing for sync + offline.

---

## Phase 2: Agent Core (Reasoning + Context)

**Goal:** The agent can hold a conversation, understand context about the user's business, and execute basic skills. This is the "brain" phase.

### Task 2.1: ContextProvider Interface + OpenViking Setup

Create `src/lib/agent/context/` with:

**Interface:**
```
ContextProvider {
  getScheduleContext(dateRange: DateRange): Promise<ScheduleContext>
  getClientContext(clientId?: string): Promise<ClientContext>
  getProfileContext(sections?: string[]): Promise<ProfileContext>
  getNotesContext(dateRange?: DateRange, keywords?: string[]): Promise<NotesContext>
  getFullContext(query: string): Promise<AgentContext>  // assembles all relevant context for a query
}
```

**OpenVikingContextProvider (primary, ships first):**
- Install OpenViking: `pip install openviking` (Python package)
- Run in embedded mode (`ov.OpenViking(path="./data")`) or as local HTTP server (port 1933, Docker or direct)
- Next.js app communicates via HTTP API (`SyncHTTPClient`)
- Create hydration pipeline: OfflineKit collection changes sync to OpenViking via `viking://` filesystem:
  - `viking://resources/calendar/` <- appointments collection
  - `viking://resources/clients/` <- clients + pets collections
  - `viking://user/profile/` <- agentProfile collection (7 sections)
  - `viking://user/memories/` <- agentNotes + agentMemories collections
  - `viking://agent/skills/` <- skill definitions
- `getScheduleContext` -> OpenViking `find()` with date-scoped URI + semantic query
- `getClientContext` -> OpenViking `find()` scoped to `viking://resources/clients/`
- `getProfileContext` -> OpenViking `find()` scoped to `viking://user/profile/`
- `getNotesContext` -> OpenViking `find()` with semantic search across `viking://user/memories/`
- `getFullContext` -> OpenViking assembles relevant context using tiered loading (L0/L1/L2)
- Hydration trigger: OfflineKit sync events -> re-index changed documents in OpenViking (incremental, document-level)
- Context assembly performance target: **<500ms on mobile** for `getFullContext`

**StructuredContextProvider (fallback):**
- Same interface, backed by OfflineKit `findMany` with date filters, client-ID joins, keyword matching
- For environments where Python/Docker is unavailable
- Swaps in via configuration without changing skill engine, prompt builder, or chat UI

**Tiered context loading (OpenViking native L0/L1/L2):**
- L0: skill definition + user message (always included, minimal tokens)
- L1: relevant entities from OpenViking semantic retrieval (appointments, clients, notes matching the query)
- L2: full context (complete profile, all notes for the period, extended history) -- only for complex reasoning like schedule building

- **Acceptance:** OpenVikingContextProvider returns relevant context for test queries. "What's my Monday schedule?" returns Monday appointments with client names. "What do I know about Sarah?" returns Sarah's client record + pets + recent appointment notes. Context assembly completes in <500ms with 100 appointments and 50 clients. Hydration pipeline syncs OfflineKit data to OpenViking within 5s of a write.

### Task 2.2: OpenRouter Integration

- Create `src/lib/agent/openrouter-client.ts` - typed client for OpenRouter API
- Implement model selection (free tier: cheaper model, paid tier: stronger model)
- **Token budget:** configurable per-request max tokens (default 2000 for conversation, 4000 for schedule building). Monthly budget cap stored in `businessProfile`. Warning at 80%, hard-stop at 95% with graceful "I've hit my thinking budget for the month" message.
- **Cost tracking:** log token usage per request to `agentMemories` collection (type: `usage-log`). Dashboard widget shows monthly spend.
- Implement PII minimization layer: replace full addresses with zones/distances, client names with initials for reasoning passes, inject full details only for client-facing message generation. Each skill declares `piiLevel: 'anonymized' | 'full'`.
- **Error handling for OpenRouter downtime:** retry with exponential backoff (3 attempts, 1s/2s/4s). On persistent failure, agent responds: "I'm having trouble thinking right now. I've saved your message and will process it when I'm back." Message queued in `agentConversations` with `status: 'pending'`.
- Create `src/lib/agent/prompt-builder.ts` - assembles system prompt + ContextProvider output + user message into an OpenRouter request
- **Acceptance:** Agent can receive a user message, retrieve relevant context from OpenVikingContextProvider, call OpenRouter, and return a coherent response. Token usage is logged. PII minimization demonstrably removes addresses from reasoning calls. OpenRouter downtime is handled gracefully.

### Task 2.3: Agent Skill Engine

- Create `src/lib/agent/skills/` with skill definitions:
  - `check-in.ts` - "What do you have for next week?" / "What's my week looking like?"
  - `adjust.ts` - "Move Sarah to Wednesday" / "Cancel Mrs. Johnson next week"
  - `learn.ts` - Pattern detection, profile update suggestions
  - `report.ts` - Weekly summary (inherits from `src/lib/schedule-intelligence/analyzer.ts`)
- Each skill defines:
  - Context requirements (which ContextProvider methods to call, at which tier L0/L1/L2)
  - Prompt template
  - OfflineKit write actions (what collections it can modify)
  - `piiLevel: 'anonymized' | 'full'` declaration
- Implement skill router: given a user message, determine which skill to invoke (or treat as general conversation)
- **Concurrency:** skill engine processes one message at a time per user. If a new message arrives while a skill is executing, it queues behind the current one. Chat UI shows "thinking..." indicator with the queued message visible.
- **Acceptance:** User can say "What's my week looking like?" and get a summary. User can say "Cancel Mrs. Johnson next week" and the appointment is updated. Skill routing is >90% accurate on 20 test messages.

### Task 2.4: Agent Chat UI (In-App)

- Create `src/app/dashboard/chat/page.tsx` - full-screen chat interface
- Message list with user/agent bubbles, timestamp, typing indicator
- Input bar with send button, auto-resize textarea
- Chat history persisted in `agentConversations` OfflineKit collection
- Agent responses streamed (OpenRouter streaming)
- Queue indicator when agent is processing a prior message
- **Voice-note style:** input should handle informal, fragmentary messages gracefully ("sarah tuesday maybe" should be interpreted, not rejected)
- **Acceptance:** User can have a multi-turn conversation with the agent. Messages persist across page reloads. Agent uses context from OpenVikingContextProvider to give relevant answers. Informal/fragmentary messages are handled.

### Task 2.5: Note Accumulation

- When user sends a message that contains scheduling intent ("trying to take Monday off", "Mrs. Johnson wants biweekly"), agent extracts and stores as `agentNote` in OfflineKit
- Agent asks clarifying questions when ambiguous
- Notes are tagged with relevant week/date and client references
- OpenVikingContextProvider includes notes in schedule-relevant queries
- **Acceptance:** User drops 3-4 notes over several messages. Agent can later retrieve them when asked "What do you have for next week so far?"

### Phase 2 Testing

- **Unit tests:** OpenVikingContextProvider methods return correct data for known inputs. Skill router maps test messages to correct skills. PII minimization strips addresses/names. Token budget enforcement.
- **Integration tests:** Full message flow: user sends message -> skill router -> context assembly -> OpenRouter call -> response rendered in chat. Note extraction -> storage -> retrieval in subsequent query.
- **Manual smoke tests:** 20-message conversation covering all skills. Verify context relevance. Test offline message queuing. Test OpenRouter timeout handling (disconnect network mid-request).
- **Tools:** Vitest for unit/integration. OpenRouter mock for deterministic skill tests.

---

## Phase 3: Schedule Building + Onboarding

**Goal:** The agent can build a draft schedule from accumulated context, and new users go through a structured onboarding flow.

### Task 3.1: Onboarding Form (7 Sections)

- Create `src/app/dashboard/settings/profile/page.tsx` with 7 form sections:
  1. Work Schedule (days, hours, breaks, horizon, build day)
  2. Service Area (towns/zones, day-area mapping)
  3. Travel Rules (max drive time, start/end preferences, equipment)
  4. Client Rules (per-client notes)
  5. Personal Commitments (recurring blocks)
  6. Business Rules (spacing, back-to-back limits, equipment)
  7. Priorities (rank: minimize driving, maximize bookings, protect days off, cluster by area)
- Each section maps to a separate document in `agentProfile` collection (keyed by section ID, not one monolithic doc)
- Sections are editable directly in the form UI
- "Clear section" button triggers agent to re-ask those questions in chat
- **Acceptance:** All 7 sections render, save to OfflineKit as individual documents, and are retrievable by OpenVikingContextProvider. Clearing a section triggers agent re-interview.

### Task 3.2: Agent-Driven Onboarding

- When a new user first chats, agent detects empty `agentProfile` and begins onboarding
- Agent asks one question at a time, maps answers to form sections
- Onboarding is interruptible (user can come back later)
- Agent populates form fields as answers come in (visible in real-time in the form UI)
- **Acceptance:** New user completes onboarding via chat. All 7 sections populated. User can verify by viewing the form.

### Task 3.3: Build Schedule Skill

- Create `src/lib/agent/skills/build-schedule.ts`
- Inputs: accumulated notes, onboarding profile (from OpenVikingContextProvider), recurring patterns, weather forecast, route options
- Calls weather API (Tomorrow.io) and route API (GraphHopper) for constraint data
- Applies constraint reasoning via OpenRouter:
  - Respect personal commitments and business rules
  - Optimize routes per zone/day
  - Account for weather on outdoor services
  - Honor client flexibility (fixed vs. flexible vs. unknown)
  - Factor in accumulated notes ("taking Monday off", "Mrs. Johnson biweekly")
- Outputs: draft schedule written to `appointments` collection with status `draft`
- Adapts to scheduling horizon (weekly, monthly, fill-open-slots)
- **Performance target:** total schedule build time <30s for 20 clients (including OpenRouter reasoning + API calls). Context assembly portion <500ms.
- **Acceptance:** Given a populated profile and 10+ clients, agent produces a valid draft schedule. No conflicts with personal commitments. Route efficiency is within 20% of GraphHopper optimal. Weather-dependent outdoor appointments avoid bad weather days. Build completes within 30s.

### Task 3.4: Schedule Review UI

- Calendar view shows draft appointments distinctly (different color/opacity)
- User can drag-to-reorder, tap-to-edit time, swipe-to-remove
- "Confirm Schedule" button locks all drafts to `confirmed` status
- "Ask Agent to Adjust" button opens chat with the draft context pre-loaded
- Map view shows draft route with numbered stops
- **Acceptance:** User can visually review a draft schedule, make manual tweaks, and confirm. Confirmed appointments are distinguishable from drafts.

### Phase 3 Testing

- **Unit tests:** Onboarding form saves/loads each section independently. Build-schedule skill produces valid appointment objects. Constraint satisfaction (no double-booking, respects personal commitments).
- **Integration tests:** Full onboarding flow via chat -> form populated. Build schedule -> review -> confirm cycle.
- **Manual smoke tests:** Onboard a new user entirely via chat. Build schedule with 15 clients across 3 zones. Verify route efficiency on map. Test "Ask Agent to Adjust" flow.
- **Tools:** Vitest. OpenRouter mock with canned schedule-building responses for deterministic tests.

---

## Phase 4: Client Communication

**Goal:** Agent can contact clients via email with booking links, track responses, and incorporate confirmations into the schedule.

### Task 4.1: Transactional Email Integration

- Select and integrate email provider (Resend, SendGrid, or Postmark - decision needed)
- Create `src/lib/email/` with send function, template rendering
- API route: `src/app/api/email/send/route.ts`
- Email templates: booking invitation, reminder, confirmation
- **Acceptance:** App can send a templated email to a test address. Email arrives, renders correctly on mobile.

### Task 4.2: Booking Page

- Create `src/app/book/[token]/page.tsx` - public, no auth required
- Displays: business logo/name, service name, 3-5 curated time slots as buttons
- Client taps a slot -> confirmation screen
- "None of these work" button -> suggest a time or decline
- Token is a signed JWT with short expiry (encodes appointment context + client ID + expiry)
- **Write path:** Client selection hits a Next.js API route (`/api/book/confirm`) which writes directly to OfflineKit via the Cloudflare Worker sync endpoint (server-side). The client has no OfflineKit instance -- the server-side API route is the write path. Agent is notified via a webhook/polling mechanism on the user's device.
- **Acceptance:** Client receives email, clicks link, sees slots, picks one. Selection is recorded in OfflineKit via server-side write. Agent is notified. Link expires after deadline.

### Task 4.3: Contact Clients Skill

- Create `src/lib/agent/skills/contact-clients.ts`
- Agent identifies which clients need confirmation for the upcoming schedule
- Generates curated time slots per client (based on flexibility, zone, route optimization)
- Presents batch list to user: "I'd like to reach out to these 6 clients -- OK to send?"
- On approval, sends emails with booking links
- Tracks responses: who confirmed, who hasn't responded
- After deadline: flags non-responders to user with options (skip, assign default slot)
- **Acceptance:** Agent proposes client outreach list. User approves. Emails sent. Client responses tracked. Non-responders flagged after deadline.

### Task 4.4: Response Integration

- When client picks a slot, agent updates the draft schedule
- Conflict detection: if two clients pick overlapping slots, agent surfaces it
- When all clients have responded (or deadline passed), agent notifies user: "Schedule is ready for review"
- **Acceptance:** 3 clients pick slots, 1 doesn't respond. Agent builds final draft with confirmed slots + flags the non-responder. User reviews in app.

### Phase 4 Testing

- **Unit tests:** JWT token generation/validation. Email template rendering. Booking page slot display logic. Conflict detection when two clients pick overlapping slots.
- **Integration tests:** Full booking flow: email sent -> client clicks link -> picks slot -> server writes to OfflineKit -> agent notified. Token expiry enforcement.
- **E2E tests (Playwright):** Booking page renders on mobile viewport. Client can tap slot and see confirmation. Expired token shows error page.
- **Tools:** Vitest for unit/integration. Playwright for booking page E2E. Email provider sandbox/test mode.

---

## Phase 5: External Messaging Bridge

**Goal:** Users can interact with the agent via iMessage, WhatsApp, or Telegram instead of (or in addition to) the in-app chat.

### Task 5.1: Messaging Platform Research

- Evaluate Twilio, MessageBird, and direct platform APIs
- Determine: cost, iMessage support (Apple Business Chat?), WhatsApp Business API requirements, Telegram Bot API
- Document decision in ADR
- **Acceptance:** Decision documented with cost estimates and integration complexity per platform.

### Task 5.2: Message Bridge Backend

- Create `src/app/api/messaging/webhook/route.ts` - receives inbound messages from platform
- Create `src/lib/messaging/bridge.ts` - normalizes messages across platforms, routes to agent backend
- Outbound: agent responses sent back through the platform API
- User configures preferred channel in settings
- **Acceptance:** User sends a message via the chosen platform. Agent receives it, processes it, responds via the same channel. Conversation history syncs to OfflineKit (visible in-app chat too).

### Task 5.3: Platform-Specific Adapters

- iMessage adapter (if feasible via Apple Business Chat)
- WhatsApp Business API adapter
- Telegram Bot API adapter
- Each adapter: handles message format conversion, media attachments, delivery receipts
- **Acceptance:** At least one external platform works end-to-end (WhatsApp or Telegram as most likely first).

### Phase 5 Testing

- **Unit tests:** Message normalization across platforms. Adapter format conversion.
- **Integration tests:** Webhook receives test payload -> routes to agent -> response sent back via platform API mock.
- **Manual smoke tests:** End-to-end with real platform (Telegram Bot API is lowest-friction for testing).
- **Tools:** Vitest. Platform sandbox/test accounts.

---

## Phase 6: Polish, Tiering, and Production Hardening

**Goal:** Production-ready with tiered plans, error handling, and monitoring.

### Task 6.1: Tiered Plans

- Free tier: smaller OpenRouter model, basic schedule building, 10 emails/week cap
- Paid tier: stronger model, unlimited outreach, pattern learning, weekly reports
- Model selection logic in OpenRouter client (per-request model choice based on tier)
- Usage tracking in OfflineKit collection
- **Acceptance:** Free user gets basic agent. Paid user gets full reasoning + unlimited outreach. Tier enforcement works.

### Task 6.2: Agent Learning Skill

- Agent suggests profile updates based on observed patterns
- "You've cancelled Monday 3 weeks in a row -- want me to mark Mondays as off?"
- Pattern detection runs weekly, stores candidates in `agentMemories`
- User confirms or dismisses suggestions
- **Acceptance:** After 4 weeks of data, agent surfaces at least one valid pattern suggestion.

### Task 6.3: PWA + Offline Hardening

- Ensure agent chat works offline (queues messages, sends when online)
- OpenRouter calls fail gracefully offline (agent says "I'll process this when you're back online")
- Booking page works when user's device is offline (client's device must be online -- booking page is server-rendered)
- **Acceptance:** User can drop notes in chat while offline. When connectivity returns, agent processes all queued messages and responds.

### Task 6.4: Production Deployment

- Update Dockerfile for new dependencies
- Environment variables: OpenRouter API key, email provider key, messaging platform keys
- Cloudflare Worker deployment pipeline (OfflineKit CLI)
- Error monitoring and agent response quality logging
- **Observability:** log agent skill invocations, context assembly times, OpenRouter latency, token usage per request. Dashboard or structured logs for debugging agent quality issues.
- **Acceptance:** App deploys to production. OfflineKit syncs to Cloudflare. Agent responds in <3s (online). Errors are captured. Observability data is accessible.

### Phase 6 Testing

- **Unit tests:** Tier enforcement logic. Pattern detection accuracy.
- **Integration tests:** Offline message queuing -> online processing. Tier-gated feature access.
- **E2E tests:** Full user journey: sign up -> onboard -> build schedule -> contact clients -> review -> confirm.
- **Load testing:** 50 concurrent users, verify Cloudflare Worker handles sync load.
- **Tools:** Vitest. Playwright for E2E. k6 or similar for load testing.

---

## Dependencies Graph

```
Phase 1 (OfflineKit Foundation + SW Update)
  |
  v
Phase 2 (Agent Core) -- depends on OfflineKit for data
  |
  +---> Phase 3 (Schedule Building + Onboarding) -- depends on agent reasoning
  |       |
  |       v
  |     Phase 4 (Client Communication) -- depends on draft schedules
  |
  +---> Phase 5 (External Messaging) -- depends on agent backend, independent of Phase 3/4
  |
  v
Phase 6 (Polish) -- depends on all above
```

**Critical Path (Minimum Viable Agent Experience):**
Phase 1 -> Phase 2 -> Phase 3 (Tasks 3.1-3.3 only) = Agent that onboards a user and builds a draft schedule

**Full Weekly Workflow Loop:**
Phase 1 -> Phase 2 -> Phase 3 -> Phase 4 = Agent builds schedule + confirms with clients

---

## Risk Areas

### High Risk

1. **OpenViking hydration performance at scale.** With 500+ clients and years of appointments, syncing OfflineKit data to OpenViking and re-indexing may be slow on initial load or after large sync batches. **Mitigation:** Hydration is incremental (document-level, not full collection). Benchmark in Phase 2.1 with synthetic data. If >500ms for context assembly, tune OpenViking's tiered loading. StructuredContextProvider fallback exists if OpenViking cannot meet targets on constrained devices.

2. **Agent reasoning quality.** Schedule building (Phase 3.3) requires the LLM to juggle many constraints simultaneously. **Mitigation:** Decompose the build into sub-steps (assign zones to days, then order within day, then resolve conflicts). Test with real scheduling scenarios early. Token budget prevents runaway costs during iteration.

3. **Messaging platform integration (Phase 5).** iMessage is notoriously hard to integrate programmatically. **Mitigation:** This is Phase 5 for a reason. In-app chat works first. Telegram Bot API is the easiest fallback.

### Medium Risk

4. **OfflineKit collection schema design.** Getting the `agentProfile` schema right (7 per-section documents) requires iteration. **Mitigation:** Use Zod discriminated unions per section. Test with real onboarding conversations before locking schema.

5. **Booking page security.** Signed JWTs must be unforgeable, expiring, and encode enough context. **Mitigation:** Short expiry (48h), signed with server secret, encode client ID + appointment context + expiry. Server-side validation on every submission.

6. **OpenRouter availability.** If OpenRouter has an outage, the agent is non-functional. **Mitigation:** Exponential backoff retry. Message queuing. Graceful degradation message. The app (calendar, clients, CRUD) still works without the agent.

### Low Risk

7. **Weather/Route API migration.** These are server-side API proxies that don't depend on the storage layer. They work today and will work the same way after OfflineKit migration.

---

## ADR: Implementation Strategy

- **Decision:** Foundation-first (Option A) - OfflineKit migration, then agent core, then client communication, then external messaging
- **Drivers:** Data availability for agent reasoning, incremental value delivery, risk sequencing
- **Alternatives considered:** Chat-bridge-first (Option B) - build external messaging first to prove the UX thesis. Invalidated because agent needs data to reason about before messaging transport matters.
- **Why chosen:** The agent needs data to reason about. OfflineKit collections must exist before the agent can do anything useful. External messaging is a transport layer that adds risk without adding reasoning capability.
- **Consequences:** Users must use in-app chat until Phase 5. The "messaging-first" vision is deferred but not abandoned. In-app chat serves as the proving ground for agent quality.
- **Follow-ups:** Phase 5 messaging platform research should begin during Phase 3 execution (non-blocking research) so decisions are ready when implementation starts.

## ADR: Context Retrieval Strategy

- **Decision:** Ship with `OpenVikingContextProvider` as the primary context layer, behind a `ContextProvider` interface. OpenViking runs as an embedded Python process or local HTTP server (port 1933), providing semantic retrieval, tiered L0/L1/L2 context loading, and self-iterating memory. `StructuredContextProvider` (OfflineKit queries) exists as a fallback for environments where Python/Docker is unavailable.
- **Drivers:** OpenViking is purpose-built for AI agent context management — semantic search, tiered loading, and automatic memory extraction from conversations. These capabilities are core to the agent's value proposition (recalling unstructured notes, learning patterns, assembling relevant context without burning tokens). OfflineKit queries alone would require building all this logic from scratch.
- **Alternatives considered:** (a) StructuredContextProvider only (OfflineKit `findMany` with filters) — sufficient for structured data but cannot do semantic retrieval on unstructured notes, which is critical for the "tell it things throughout the week" use case. (b) Orama/Vectra embedded — viable JS-native options but less feature-complete than OpenViking for agent-specific context management. (c) No interface, hard-couple to OpenViking — rejected to avoid vendor lock-in even though OpenViking is open source.
- **Why chosen:** OpenViking provides semantic retrieval, tiered context loading, and self-iteration out of the box. The agent accumulates unstructured notes throughout the week ("taking Monday off unless it rains") that need semantic, not keyword, retrieval. The ContextProvider interface preserves flexibility without sacrificing capability.
- **Consequences:** Requires Python runtime or Docker on the deployment target for the primary provider. Adds a cross-language integration (Next.js ↔ OpenViking HTTP API). The StructuredContextProvider fallback ensures the system degrades gracefully.
- **Follow-ups:** Benchmark OpenViking embedded mode performance on target devices. Monitor for a potential JS/WASM port of OpenViking that could eliminate the Python dependency.

---

## Estimated Complexity

| Phase | Tasks | Complexity | Notes |
|-------|-------|-----------|-------|
| Phase 1 | 6 | HIGH | Full storage/auth/sync layer replacement + SW update |
| Phase 2 | 5 | HIGH | ContextProvider + OpenRouter + skill engine |
| Phase 3 | 4 | HIGH | Agent reasoning for constraint satisfaction |
| Phase 4 | 4 | MEDIUM | Email + booking page, well-defined scope |
| Phase 5 | 3 | HIGH | External platform dependencies, approval processes |
| Phase 6 | 4 | MEDIUM | Polish and hardening |

**Total: 26 tasks across 6 phases**

---

## Open Questions (Tracked)

See `.omc/plans/open-questions.md` for the full list.
