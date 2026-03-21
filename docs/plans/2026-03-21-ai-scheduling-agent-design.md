# AI Scheduling Agent - Design Document

> **Date:** 2026-03-21
> **Status:** Approved
> **Fork of:** KE Agenda V3

---

## 1. Product Vision

A forked scheduling app for mobile service professionals where an AI agent is the primary interface. Users message the agent throughout the week — dropping notes, preferences, and constraints — and when it's time to build the next schedule, the agent assembles an optimized draft using everything it knows: client locations, weather, personal commitments, business rules, and accumulated context.

The agent contacts clients to confirm availability via "pick a slot" booking links, builds the schedule, and notifies the user to review it in the app. The app's calendar, map, and client screens serve as the visual layer for reviewing and tweaking what the agent produces.

**Core principle:** The agent is the product. The UI is for review, override, and transparency.

---

## 2. Architecture

### Three Pillars

- **OpenRouter** — LLM reasoning layer. Powers all agent conversation, schedule building logic, and client communication drafting. Model-agnostic, supports tiered plans (cheaper models for free tier, stronger models for paid).

- **OfflineKit** — Storage and sync layer. Replaces SQLite WASM + Kysely + PostgreSQL + Hasura with a unified, type-driven offline-first SDK. All data lives in IndexedDB locally and syncs to Cloudflare Workers (R2 + KV) via Last-Write-Wins protocol. Collections include:
  - Business data: `clients`, `appointments`, `services`, `pets`
  - Agent data: `agentNotes` (weekly accumulated notes), `agentProfile` (onboarding form sections), `agentMemories` (learned patterns)
  - Auth built-in (replaces Better Auth)
  - React hooks for UI bindings (`useCollection`, `useAuth`, `useSync`)

- **OpenViking** — Agent context intelligence, running as **embedded Python process or local HTTP server (port 1933)**. Install via `pip install openviking` or Docker. Next.js communicates via HTTP API. Semantic index over OfflineKit data — NOT the source of truth, but the smart retrieval layer. Provides:
  - Semantic search: "What do I know that's relevant to building Monday's schedule?"
  - Tiered context loading (L0/L1/L2) — only burn tokens on what matters
  - Self-iteration — automatically extracts long-term memories from conversations
  - Virtual filesystem for agent organization:
    - `viking://user/memories/` — Learned preferences, weekly notes
    - `viking://user/profile/` — Structured onboarding form data
    - `viking://resources/calendar/` — Appointment and schedule data
    - `viking://resources/clients/` — Client records, flexibility, contact preferences
    - `viking://agent/skills/` — "Build schedule," "Contact clients," etc.

### Data Architecture

```
OfflineKit (source of truth, sync + storage)
    ↕ syncs across devices via Cloudflare Workers
    ↕ hydrates on each device
OpenViking (semantic index, on-device, read-only)
    ↕ provides relevant context to
OpenRouter (LLM reasoning)
```

- **OfflineKit** owns all data. Multi-device sync is automatic (tab focus, network reconnect, 30s interval).
- **OpenViking** is a local semantic index rebuilt from OfflineKit data on each device. It decides *which* context is relevant for a given agent task, avoiding expensive full-context LLM prompts.
- When OfflineKit syncs new data (e.g., a note added on the phone), OpenViking re-indexes locally on each device.

### Chat Interface

User communicates with the agent via their preferred messaging platform (iMessage, WhatsApp, Telegram). The app bridges these channels to the agent backend. Messaging platform integration approach TBD (build vs. service like Twilio/MessageBird).

### Client Communication

Agent sends emails with "pick a slot" booking links. Client clicks through to a minimal booking page showing curated time slots. No account required.

### Data Flow

```
User (chat) → Messaging Platform → Agent Backend → OpenRouter (reasoning)
                                                  → OpenViking (context, on-device)
                                                  → OfflineKit (read/write, syncs to cloud)
                                                  → Weather/Routes APIs
```

---

## 3. Onboarding Flow

The agent's first interaction with a new user is a structured interview that populates a visible, editable form in the app. The agent asks questions conversationally in chat, but answers map to specific form sections.

### Seven Sections

1. **Work Schedule** — Days you work, start/end times, break preferences, scheduling horizon (weekly / rolling monthly / months ahead / mix), preferred schedule build day
2. **Service Area** — Towns/zones, which days for which areas
3. **Travel Rules** — Max drive time, prefer to start/end near home, equipment locations
4. **Client Rules** — Per-client notes (always late, morning only, needs extra time, etc.)
5. **Personal Commitments** — Recurring blocks (school pickup, gym, doctor)
6. **Business Rules** — Spacing between appointments, back-to-back limits, equipment constraints
7. **Priorities** — Rank what matters most: minimize driving, maximize bookings, protect days off, cluster by area

### UX Rules

- Each section is visible in the app as a form the user can edit directly
- User can clear any section to have the agent re-ask those questions
- Agent asks one question at a time in chat, fills in the form as answers come in
- Onboarding doesn't have to happen all at once — user can come back to it
- Agent can suggest updates to sections over time ("You've cancelled Monday 3 weeks in a row — want me to mark Mondays as off?")

---

## 4. Weekly Workflow

### Passive Accumulation (Throughout the Week)

- User messages the agent anytime: "Trying to take Monday off next week," "Mrs. Johnson wants to switch to biweekly," "I need to be in Plainfield on Tuesday"
- Agent acknowledges, stores as notes in OpenViking
- Agent can ask clarifying questions: "Does that mean skip Mrs. Johnson next week, or start biweekly going forward?"

### Schedule Build (User's Preferred Build Day)

1. Agent reviews accumulated notes, onboarding profile, and recurring client patterns
2. Pulls weather forecast, calculates route options per zone/day
3. Identifies which clients need confirmation — builds "pick a slot" links with curated time windows
4. Messages user: "I need to reach out to 6 clients for next week. Here's who and what I'm asking — OK to send?"
5. User approves in chat, agent sends emails
6. Waiting period for client responses (configurable deadline)
7. Agent assembles draft schedule from confirmed slots + recurring clients + constraints
8. Notifies user: "Next week's schedule is ready — review it in the app"
9. User opens app, reviews calendar/map view, makes tweaks, confirms
10. Confirmed appointments are locked in, clients notified of final times

### Scheduling Horizon Adaptation

- **Weekly builders** — Full build cycle each week
- **Monthly/long-term users** — "Build next month" or "Fill open slots for the next 6 weeks," focused on slotting new clients around a stable recurring base
- **Mix users** — Stable recurring backbone maintained by agent, weekly build handles flexible/open slots only
- **Client outreach adapts** — Long-term clients get offered recurring commitments ("Every Tuesday at 10am for 8 weeks"), not just single slots

### Edge Cases

- Client doesn't respond by deadline → agent flags it, suggests a default slot or skip
- User changes mind mid-week → "Actually I can work Monday" → agent adjusts notes
- Conflict detected → agent surfaces it: "You said Monday off but 3 fixed clients are Monday-only. Want me to keep those 3?"
- Client can't do next week → agent notes it: "Last week you said you couldn't do next week — does Wednesday still work?"

---

## 5. Client Communication

### Outbound (Agent → Client)

- Agent drafts emails with a "pick a slot" booking link
- Email shows: service name, 3-5 curated time slots across the relevant days, business name
- Client clicks link → lands on a simple booking page (no login required)
- Client picks a slot → agent is notified, slot is locked

### Booking Page

- Minimal: business logo, service, available slots as buttons
- Client taps a slot, gets a confirmation screen
- No account creation, no portal login — zero friction
- "None of these work" button lets the client suggest a time or decline that week

### Follow-Up

- If client doesn't respond by deadline, agent sends one reminder
- After that, flags it for the user: "Sarah hasn't responded — skip her or assign a default slot?"

### Contact Channel

- Email is default (near-zero cost at launch)
- Stored per-client on the client record
- Future expansion: WhatsApp Business API, other channels

### User Approval Rule

- Agent always asks permission before contacting clients (in chat)
- Can batch: "I'd like to reach out to these 6 clients — OK?" with a list
- User can approve all or exclude specific ones

---

## 6. Agent Skills

Defined skills in OpenViking (`viking://agent/skills/`):

### Build Schedule
- Triggered manually ("build next week") or automatically on the user's preferred build day
- Scope adapts to scheduling horizon (next week, next month, fill next 6 weeks)
- Full reasoning: weighs weather, routes, client flexibility, personal commitments, business rules, zone preferences, accumulated notes

### Contact Clients
- Sends "pick a slot" emails, tracks responses
- Batched approval from user before sending

### Check In
- "What do you have for next week so far?" — summarizes accumulated notes and known constraints
- "What's my week looking like?" — current schedule summary with weather/route highlights

### Adjust
- "Move Sarah to Wednesday" — user requests changes, agent handles cascading effects
- "Cancel Mrs. Johnson next week" — agent notes it, adjusts route

### Learn
- Agent suggests profile updates based on observed patterns
- "You've ended before 3pm the last 4 Fridays — want me to block after 3 on Fridays?"

### Report
- Weekly summary: miles driven, appointments completed, revenue, efficiency score
- Inherits from existing schedule intelligence analysis

---

## 7. Review & Approval Model

**Chat is for:**
- Dropping notes and context throughout the week
- Quick confirmations ("OK to contact these clients?")
- Asking the agent questions ("What do you have so far?")
- Corrections ("Actually I can work Monday")

**App is for:**
- Reviewing draft schedules (calendar + map view)
- Tweaking appointment times and order
- Confirming/finalizing the schedule
- Editing the onboarding profile form
- Viewing reports

**Rule:** The agent never asks for complex approvals in chat. For anything that needs visual review, the agent says "go check it in the app."

---

## 8. Tiered Plans

### Free Tier
- Smaller/cheaper model via OpenRouter
- Basic schedule building (fewer optimization passes)
- Limited client outreach (e.g., 10 emails/week)
- Core onboarding profile + notes

### Paid Tier
- Stronger model for deeper reasoning
- Unlimited client outreach
- Full constraint optimization (routes, weather, preferences all factored)
- Pattern learning ("You've cancelled Monday 3 weeks in a row...")
- Weekly reports

Model selection and pricing are later decisions. OpenRouter's model-agnostic API supports swapping models per request, making tiering straightforward.

---

## 9. PII & Data Privacy

### On-Device Only
- **OpenViking (embedded)** — Semantic index of agent context. Never leaves the device.

### Synced via OfflineKit (Cloudflare R2 + KV)
- **All business data** — Clients, appointments, services, pets, agent notes, agent profile, agent memories sync across devices via Cloudflare Workers. This is PII in the cloud but under user control.
  - **Mitigation:** OfflineKit uses Cloudflare infrastructure (not a shared multi-tenant DB). Each user's data is isolated. Encryption at rest via Cloudflare's default encryption. Consider adding client-side encryption for sensitive fields (addresses, phone numbers) as a future enhancement.

### Third-Party Transit
- **OpenRouter** — Client data passes through LLM calls for reasoning. This is the primary PII concern.
  - **Mitigation:** Minimize what's sent — use zone/distance instead of full addresses, client IDs or initials instead of full names in reasoning passes, inject full details only when generating client-facing messages
- **Email provider** — Client email addresses and names for outreach (necessary, minimal)
- **Booking page** — Hosted, but minimal PII (name, service, time slots)

### Future Considerations
- OpenRouter data retention policies should be reviewed per model provider
- Client-side encryption for sensitive OfflineKit fields before sync
- Consider offering a "privacy mode" where users can opt into heavier PII anonymization at the cost of slightly less personalized agent responses
- Research whether on-device LLM inference becomes viable for the reasoning layer (would eliminate OpenRouter transit entirely)

---

## 10. What Carries Over from KE Agenda

### Inherited (concepts, not code)
- Client, appointment, service, pet data models (reimplemented as OfflineKit collections)
- Weather integration (Tomorrow.io)
- Route optimization (GraphHopper + Haversine fallback)
- Calendar/map views for schedule review
- shadcn/ui + Tailwind CSS for UI

### Replaced
- SQLite WASM + Kysely → OfflineKit (IndexedDB + Cloudflare sync)
- PostgreSQL + Hasura → OfflineKit Cloudflare Workers (auto-generated)
- Better Auth → OfflineKit built-in auth
- Manual sync queue → OfflineKit LWW sync engine

### New
- OfflineKit integration (storage, sync, auth — single SDK)
- OpenViking integration (semantic context index, embedded on-device)
- OpenRouter integration (LLM reasoning)
- Messaging bridge (iMessage/WhatsApp/Telegram)
- "Pick a slot" booking page (public, no auth)
- Structured onboarding form (7 sections, agent-populated)
- Agent skill execution engine
- Transactional email sending

### Demoted
- Manual appointment CRUD → secondary, available as override
- Schedule intelligence dashboard → absorbed into agent reasoning
- Client portal → replaced by simpler "pick a slot" booking page

---

## 11. Open Questions

- [ ] Messaging platform integration approach (build vs. Twilio/MessageBird)
- [ ] Email provider selection (Resend, SendGrid, Postmark)
- [ ] Product name
- [ ] Pricing specifics
- [ ] Client contact channel research (email vs. WhatsApp Business API vs. other)
- [ ] On-device LLM feasibility for privacy-sensitive users
