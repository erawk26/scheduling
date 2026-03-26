# PRD: KE Agenda V7 - Focus Group Feedback Cycle

**Version:** 2.1
**Date:** 2026-03-26
**Status:** Approved — Ralplan consensus reached (Planner + Architect + Critic)
**Scope:** Next development cycle informed by beta tester focus group

---

## 1. Executive Summary

Three beta testers (horse trainer, pet groomer, personal trainer) validated KE Agenda's core value proposition but surfaced 15 prioritized findings across billing UX, onboarding, scheduling model, communication channels, and weather intelligence. This PRD defines a phased implementation plan to address all findings while preserving the local-first architecture.

### Focus Group Personas

| Persona | Business | Location | Scale | Key Constraint |
|---------|----------|----------|-------|----------------|
| **Megan Calloway** | Horse trainer | Aiken, SC | 18 clients, 3 zones | Outdoor work, equipment trailer, weather-sensitive |
| **Devon Park** | Pet groomer | Portland, OR | 42 clients, 4 zones | Mobile van, high volume, tight scheduling |
| **Andre Mitchell** | Personal trainer | Austin, TX | 24 clients, split AM/PM | Indoor+outdoor, regional weather norms differ |

---

## 2. RALPLAN-DR Summary

### Principles (5)

1. **User-invisible infrastructure** - Users must never interact with developer concepts (API keys, tokens, LLM providers). The product is a scheduling assistant, not a developer tool.
2. **Progressive disclosure** - Empty states guide; complexity reveals itself only as the user's business grows. A first-time user with 0 clients should feel welcomed, not overwhelmed.
3. **Communication where clients already are** - Email works for ~50% of clients. SMS/iMessage must be a first-class channel alongside email and Telegram.
4. **Agent proactivity with user control** - The agent should initiate (weather alerts, schedule suggestions) but never act without explicit confirmation. Individual confirmation, not batch-only.
5. **Regional context matters** - Weather thresholds, work patterns, and scheduling norms vary by geography and profession. Defaults must be overridable.

### Decision Drivers (Top 3)

1. **Conversion blocker removal** (P0) - API key setup and empty-dashboard friction will cause 80%+ churn at signup. These must ship first.
2. **Scheduling model completeness** (P1) - Recurring intervals and blocked time are table-stakes for any scheduling product. Without them, users revert to pen-and-paper.
3. **Multi-channel communication** (P1/P2) - Email-only reaches half the client base. SMS is the missing link for professional-to-client communication.

### Viable Options

#### Option A: Server-Managed Keys + Deferred Billing (Recommended)

Decouple the conversion blocker (API key friction) from the revenue model (Stripe billing). At signup, the server provisions an OpenRouter API key per user, stored in the DB. Free tier ships immediately with a budget cap. Stripe billing is a separate, later phase.

- **Pros:** Ships in days not weeks, zero friction signup, eliminates P0 blocker immediately, no Stripe dependency on critical path, can switch LLM providers without user impact
- **Cons:** No revenue from day one (free tier only until Stripe ships), must manage per-user key provisioning, need budget enforcement without billing infrastructure
- **Why chosen:** Directly addresses P0-1 (the top blocker) with minimal implementation surface. Stripe can follow independently without blocking user conversion.

#### Option B: Full Managed Subscription (Viable, deferred)

Bundle API key provisioning and Stripe billing into a single Phase 7A task. Users subscribe at $10-15/month, KE Agenda provisions and manages the API key server-side.

- **Pros:** Revenue from day one, predictable costs, complete billing flow
- **Cons:** 2-3x implementation time for Phase 7A, Stripe integration complexity on the critical path, webhook reliability concerns delay the P0 fix
- **Not chosen for 7A but viable for 7E:** Billing is important but does not need to ship simultaneously with the key provisioning that unblocks conversion.

#### Option C: BYOK with Guided Setup

Keep bring-your-own-key but add a step-by-step wizard with screenshots, auto-validation, and a "test my key" button.

- **Invalidation rationale:** All three personas explicitly rejected any flow involving external API key management. Devon (42 clients, highest volume) said "I'd just use a spreadsheet" if setup required pasting API keys.

---

## 3. Phased Implementation Plan

### Phase 7A: Conversion Unblockers (P0)

**Goal:** Remove the two biggest churn points: API key setup and empty-state confusion.

#### Task 7A-1a: Server-Managed API Keys (Decoupled from Billing)

**Description:** Replace the BYOK API key flow with server-provisioned keys. At user signup, the server creates an OpenRouter API key (or allocates from a key pool) and stores it in the DB. Users never see "OpenRouter" or "API key." Free tier ships immediately with a budget limit.

**Rationale for decoupling:** Stripe billing (7A-1b, now moved to 7E) is a 1-2 week effort with webhook complexity. Server-managed keys can ship in 1-3 days and immediately unblock P0 conversion. Billing follows independently.

**Schema Changes:**
- Extend `BusinessProfileSchema` with:
  - `subscription_tier: z.enum(['free', 'paid']).default('free')` (matches existing `TierConfig.name` values in `src/lib/agent/tier.ts`)
  - `openrouter_key_ref: z.string().nullable().optional()` (server-side reference to provisioned key, never sent to client)
  - `tier_verified_at: z.string().datetime().nullable().optional()` (last time tier was verified against server)

**TierConfig Alignment:** The current codebase (`src/lib/agent/tier.ts`) uses `'free' | 'paid'` for `TierConfig.name`. This PRD aligns with that. The `'trial'` and `'pro'` tiers are deferred to Task 7E-5 (Stripe Billing) where `TierConfig` will be extended to `'free' | 'trial' | 'pro'` alongside the billing infrastructure that needs those distinctions.

**Key Changes:**
- `src/lib/agent/tier.ts` - Keep existing `'free' | 'paid'` types. Add `getUserTierFromProfile()` that reads `subscription_tier` from `BusinessProfileSchema` instead of the current unsafe cast. Remove `OPENROUTER_API_KEY` from user-facing config.
- `src/lib/agent/openrouter-client.ts` - Read API key from server-side provisioned key record (via API route), not env var. Add per-user usage metering against budget limit.
- New: `src/app/api/agent/provision-key/route.ts` - Called at signup. Provisions an OpenRouter key (or allocates from pool), stores reference in BusinessProfile.
- New: `src/lib/agent/key-manager.ts` - Server-side key provisioning, pool management, budget enforcement.

**Offline Degradation Strategy:**
- Cache `subscription_tier` and `tier_verified_at` in the local `BusinessProfile` document (already local-first via OfflineKit).
- On each dashboard load, if online, verify tier against server and update `tier_verified_at`.
- **Grace period:** If `tier_verified_at` is older than 7 days and device is offline, continue operating at the last-verified tier.
- **Degradation path:** If grace period expires (>7 days offline without verification), fall back to free-tier-equivalent limits (50K tokens, 10 emails/week). Agent continues to function but with reduced budget.
- **Re-verification:** On reconnect, immediately re-verify tier against server. If tier is still valid, restore full limits and update `tier_verified_at`. If tier has changed (e.g., subscription lapsed), update locally.
- **Implementation:** Add `verifyTier()` function to `src/lib/agent/tier.ts` that checks `tier_verified_at` age and returns effective tier (may differ from stored tier if grace expired).

**UI Changes:**
- Settings page: Show current plan (Free/Paid) with usage meter
- Remove any "API Key" input fields from settings
- Add usage indicator to sidebar (e.g., "42% of monthly AI budget used")

**Acceptance Criteria:**
- [ ] New user can sign up and use the AI agent without ever seeing "OpenRouter" or "API key"
- [ ] Free tier uses budget-limited model (current `google/gemma-2-9b-it:free`) with 50K tokens/month
- [ ] Server provisions key at signup with zero user interaction
- [ ] Usage meter shows tokens consumed vs. limit with warning at 80%
- [ ] Offline: app uses cached tier for up to 7 days without verification
- [ ] Offline >7 days: graceful degradation to free-tier limits
- [ ] On reconnect: tier re-verified and limits restored

**Testing:**
- **Unit:** `verifyTier()` returns correct effective tier for various `tier_verified_at` ages (fresh, 3 days, 7 days, 14 days). Key provisioning creates valid key reference.
- **Integration:** Signup flow provisions key and stores reference. Usage metering correctly tracks tokens against budget. Tier verification API returns correct status.
- **E2E:** New user completes signup, sends first agent message, receives response -- no API key screens encountered.

**Rollback:** If key provisioning fails, fall back to env-var-based `OPENROUTER_API_KEY` (the current behavior). Feature flag: `MANAGED_KEYS_ENABLED` env var, defaults to `true`.

---

#### Task 7A-2: New-User Onboarding Flow

**Description:** Guided onboarding wizard for first-time users. Detects empty state (0 clients, 0 services) and presents a 4-step setup flow instead of the bare dashboard.

**New Files:**
- `src/components/onboarding/onboarding-wizard.tsx` - Multi-step wizard container
- `src/components/onboarding/steps/welcome-step.tsx` - Business type selection (groomer, trainer, etc.)
- `src/components/onboarding/steps/services-step.tsx` - Add first 1-3 services with templates per business type
- `src/components/onboarding/steps/schedule-step.tsx` - Set work hours, days off, service area
- `src/components/onboarding/steps/first-client-step.tsx` - Add first client (optional, can skip)

**Schema Changes:**
- Extend `BusinessProfileSchema` with:
  - `onboarding_completed: z.boolean().default(false)`
  - `business_type: z.enum(['pet_groomer', 'horse_trainer', 'personal_trainer', 'dog_trainer', 'music_teacher', 'other']).nullable().optional()`

**OfflineKit Migration Note:** All new fields use `.default()` or `.optional()`. mpb-localkit applies Zod `.default()` values on document read, so existing BusinessProfile documents will receive `onboarding_completed: false` and `business_type: null` automatically. No explicit migration step needed. **If testing reveals that mpb-localkit does NOT apply defaults on read**, add a migration function in `src/lib/offlinekit/index.ts` that runs once on app startup to backfill missing fields on existing documents.

**UI Changes:**
- `src/app/dashboard/page.tsx` - Check `onboarding_completed` flag. If false, render `<OnboardingWizard />` instead of dashboard.
- Service templates pre-populated per business type (e.g., horse trainer gets "60-min Lesson", "30-min Lunge", "Horse Evaluation")
- Wizard completion sets `onboarding_completed = true` and redirects to dashboard with a congratulatory state

**Acceptance Criteria:**
- [ ] First login shows wizard, not empty dashboard
- [ ] Business type selection loads relevant service templates
- [ ] Work hours and service area saved to `agentProfile` (sections: `work-schedule`, `service-area`)
- [ ] User can skip any step and complete later
- [ ] After wizard, dashboard shows stats with real data from what was entered
- [ ] Returning users never see the wizard again

**Testing:**
- **Unit:** Business type -> template mapping returns correct services. Onboarding state check logic.
- **Integration:** Wizard completion writes to OfflineKit `businessProfile` and `agentProfile`. Existing user documents receive default field values.
- **E2E:** New user flow from signup through wizard to populated dashboard.

**Rollback:** Wizard is behind `onboarding_completed` flag. If wizard has issues, set flag to `true` in DB to bypass. Dashboard remains fully functional without onboarding.

---

### Phase 7B: Scheduling Model (P1)

**Goal:** Add recurring appointment intervals and blocked/personal time to make the calendar production-ready.

#### Task 7B-1: Recurring Appointment Intervals on Client Model

**Description:** Allow setting a recurring cadence per client-service pair: "Megan's horse Baron gets a lesson every 4 weeks, Thursdays preferred." The agent's `build-schedule` skill uses these when generating weekly drafts.

**Schema Changes:**
- New collection `RecurrenceRuleSchema`:
  ```
  client_id: z.string().uuid()
  service_id: z.string().uuid().nullable().optional()  // null = applies to all services
  pet_id: z.string().uuid().nullable().optional()
  interval_weeks: z.number().int().min(1).max(52)
  preferred_day: z.enum(['monday','tuesday','wednesday','thursday','friday','saturday','sunday']).nullable().optional()
  preferred_time_slot: z.enum(['morning','midday','afternoon','evening']).nullable().optional()
  active: z.boolean().default(true)
  last_scheduled_at: z.string().datetime().nullable().optional()
  ```
- Add to `collections` map as `recurrenceRules: collection(RecurrenceRuleSchema)`

**Skill Modifications:**
- `src/lib/agent/skills/build-schedule.ts` - Query `recurrenceRules` collection. For each active rule where `last_scheduled_at` is older than `interval_weeks` ago, generate a draft appointment on the preferred day/time. Respect existing blocked time.
- `src/lib/agent/context/types.ts` - Add `getRecurrenceRules()` method signature to the `ContextProvider` interface definition.
- `src/lib/agent/context/structured-provider.ts` - Implement `getRecurrenceRules()` method in the `StructuredContextProvider` class.

**UI Changes:**
- `src/app/dashboard/clients/[id]/page.tsx` - Add "Recurring Schedule" section to client detail page. Shows active rules with edit/delete. "Add Recurrence" button opens a form.
- New component: `src/components/clients/recurrence-form.tsx` - Form for interval, preferred day, preferred time, service, pet selection.

**Acceptance Criteria:**
- [ ] User can set "every N weeks" on a client with preferred day and time slot
- [ ] `build-schedule` skill respects recurrence rules when generating weekly drafts
- [ ] Rules visible and editable on client detail page
- [ ] Agent mentions recurrence basis in schedule rationale ("Baron is due for a lesson - last one was 4 weeks ago")
- [ ] Multiple rules per client supported (different services, different pets)

**Testing:**
- **Unit:** Recurrence rule expiry calculation. `build-schedule` draft generation from rules with various `last_scheduled_at` values.
- **Integration:** Create rule via UI, trigger `build-schedule`, verify draft appointments appear on correct day/time.
- **E2E:** Full flow: add recurrence rule on client detail -> agent builds schedule -> draft appears on calendar.

**Rollback:** Recurrence rules are additive. Remove the `recurrenceRules` collection query from `build-schedule` to disable. Existing schedules unaffected.

---

#### Task 7B-2: Blocked Time / Personal Commitments on Calendar

**Description:** Users need to mark personal time, lunch breaks, travel blocks, and non-working windows. These appear as gray zones on the calendar and are respected by the agent when building schedules.

**Schema Changes:**
- New collection `BlockedTimeSchema`:
  ```
  title: z.string().min(1)
  start_time: z.string().datetime()
  end_time: z.string().datetime()
  recurrence: z.enum(['none', 'daily', 'weekly', 'biweekly']).default('none')
  recurrence_end: z.string().datetime().nullable().optional()
  all_day: z.boolean().default(false)
  color: z.string().default('gray')  // for UI display
  ```
- Add to `collections` map as `blockedTime: collection(BlockedTimeSchema)`

**Skill Modifications:**
- `src/lib/agent/skills/build-schedule.ts` - Query `blockedTime` collection. Expand recurring blocks into concrete time ranges for the target week. Never place draft appointments overlapping blocked time.
- `src/lib/agent/context/types.ts` - Add `BlockedTimeSummary` and include in `ScheduleContext`.

**UI Changes:**
- `src/components/appointments/calendar-view.tsx` - Render blocked time as gray overlay zones on the time grid (day/week views). Month view shows a subtle indicator.
- New component: `src/components/calendar/blocked-time-form.tsx` - Quick-add blocked time by clicking/dragging on calendar or via a button.
- Add "Block Time" button to calendar toolbar alongside existing view controls.

**Acceptance Criteria:**
- [ ] User can create one-off or recurring blocked time entries
- [ ] Blocked time renders as gray zones on day/week calendar views
- [ ] Agent never schedules appointments during blocked time
- [ ] "Block Time" accessible from calendar toolbar
- [ ] Recurring blocks expand correctly (e.g., weekly lunch block shows every week)

**Testing:**
- **Unit:** Recurring block expansion for various recurrence types (daily, weekly, biweekly) with edge cases (recurrence_end, all_day).
- **Integration:** `build-schedule` avoids placing drafts during blocked time. Calendar view renders blocks at correct positions.
- **E2E:** Create recurring lunch block -> verify it appears on calendar every day -> agent skips that window in schedule.

**Rollback:** Remove `blockedTime` queries from `build-schedule` and calendar rendering. Blocked time data preserved in collection for re-enablement.

---

#### Task 7B-3: Individual Draft Confirmation

**Description:** Currently only batch "Confirm All" exists for draft schedules. Users need per-appointment confirm/reject buttons.

**UI Changes:**
- `src/app/dashboard/appointments/page.tsx` (or wherever draft list renders) - Add per-row "Confirm" and "Decline" buttons next to each draft appointment.
- Confirm changes status from `draft` to `confirmed`. Decline changes to `cancelled` with an optional reason.
- Keep "Confirm All" as a batch action, but make individual actions the primary interaction.

**Skill Modifications:**
- `src/lib/agent/skills/respond-integration.ts` - Handle individual confirmation responses, not just batch.

**Acceptance Criteria:**
- [ ] Each draft appointment has its own Confirm and Decline buttons
- [ ] Confirming one does not affect others
- [ ] Declining prompts for optional reason (stored in `internal_notes`)
- [ ] "Confirm All" still works as a batch shortcut
- [ ] Agent can report on which drafts were confirmed vs. declined

**Testing:**
- **Unit:** Status transition logic (draft -> confirmed, draft -> cancelled with reason).
- **Integration:** Confirm/decline updates OfflineKit document. Agent context reflects updated statuses.
- **E2E:** View draft list, confirm 2 of 4, decline 1, verify calendar reflects changes.

**Rollback:** Hide individual buttons via CSS/feature flag. "Confirm All" remains as fallback.

---

### Phase 7C: Communication Channels (P1/P2)

**Goal:** Add SMS as a client communication channel alongside existing email and Telegram.

#### Task 7C-1a: Twilio SMS Adapter

**Description:** Implement the `PlatformAdapter` for Twilio SMS, following the existing pattern in `src/lib/messaging/adapters/telegram.ts`.

**Prerequisite:** Extend `NormalizedMessage.platform` type (see below).

**Schema Changes to `src/lib/messaging/types.ts`:**
- Extend `NormalizedMessage.platform` from `'telegram' | 'whatsapp' | 'imessage'` to `'telegram' | 'whatsapp' | 'imessage' | 'sms' | 'email'`
- This is a breaking type change -- all `switch` statements on `platform` must be updated to handle the new variants.

**New Files:**
- `src/lib/messaging/adapters/twilio.ts` - Implements `PlatformAdapter` for Twilio SMS. Sends via Twilio REST API. Parses inbound SMS webhooks into `NormalizedMessage` with `platform: 'sms'`.

**Schema Changes:**
- Extend `ClientSchema` with:
  - `preferred_contact: z.enum(['email', 'sms', 'telegram', 'any']).default('any')`
  - `sms_opt_in: z.boolean().default(false)` (TCPA compliance -- see Task 7C-1e)
- Extend `BusinessProfileSchema` with:
  - `twilio_phone_number: z.string().nullable().optional()` (provisioned number, server-managed)

**Acceptance Criteria:**
- [ ] Twilio adapter implements `PlatformAdapter` interface (parseInbound, formatOutbound, sendMessage)
- [ ] `NormalizedMessage.platform` includes `'sms'` and `'email'`
- [ ] SMS sends via Twilio REST API with proper error handling
- [ ] Adapter follows same patterns as existing Telegram adapter

**Testing:**
- **Unit:** `parseInbound` correctly normalizes Twilio webhook payload. `formatOutbound` produces valid Twilio API request body.
- **Integration:** Send test SMS via adapter, verify delivery. Parse inbound webhook, verify `NormalizedMessage` shape.

**Rollback:** Adapter is opt-in. If Twilio adapter fails, remove from adapter registry. Email and Telegram continue working.

---

#### Task 7C-1b: Contact-Clients Skill Refactor for Multi-Channel Routing

**Description:** Refactor the `contact-clients` skill to support routing outreach through the appropriate channel (email, SMS, Telegram) based on client preference. Currently hardcoded to email-only.

**Changes to `src/lib/agent/skills/contact-clients.ts`:**

1. **Extend `ClientOutreach` interface:**
   ```
   interface ClientOutreach {
     clientId: string;
     clientName: string;
     email: string;
     phone: string | null;         // NEW
     preferredContact: string;     // NEW: 'email' | 'sms' | 'telegram' | 'any'
     smsOptIn: boolean;            // NEW: TCPA compliance check
     channel: 'email' | 'sms' | 'telegram';  // NEW: resolved channel
     slots: string[];
   }
   ```

2. **Refactor `buildOutreachList()`:** Add channel resolution logic:
   - If `preferred_contact === 'sms'` AND `sms_opt_in === true` AND `phone` exists -> channel = `'sms'`
   - If `preferred_contact === 'sms'` AND `sms_opt_in === false` -> channel = `'email'` (with note that client hasn't opted in to SMS)
   - If `preferred_contact === 'email'` OR `preferred_contact === 'any'` -> channel = `'email'`
   - If `preferred_contact === 'telegram'` -> channel = `'telegram'`

3. **Refactor `buildSystemPrompt()`:** Include channel per client in the prompt so the agent's summary tells the user which channel each client will be reached on.

**Acceptance Criteria:**
- [ ] `contact-clients` skill resolves channel per client based on `preferred_contact` and `sms_opt_in`
- [ ] Outreach plan includes channel per client
- [ ] Agent summary shows which channel each client will be contacted through
- [ ] Clients without SMS opt-in are routed to email with a note

**Testing:**
- **Unit:** Channel resolution logic for all preference + opt-in combinations.
- **Integration:** Skill produces correct outreach plan with mixed channels from test client data.

**Rollback:** Revert `buildOutreachList` to email-only. Channel field defaults to `'email'`.

---

#### Task 7C-1c: MessageBridge Integration for Outbound Delivery

**Description:** Connect the outreach plan from `contact-clients` to the `MessageBridge` for actual delivery across channels.

**Changes:**
- `src/lib/agent/skills/contact-clients.ts` - After user approves outreach plan, dispatch messages through `MessageBridge.send()` using the resolved channel per client.
- `src/lib/messaging/bridge.ts` - Ensure `send()` routes to correct adapter based on `OutboundMessage.platform`.

**Acceptance Criteria:**
- [ ] Approved outreach sends via correct channel (email adapter, Twilio SMS adapter, or Telegram adapter)
- [ ] Delivery status tracked per message
- [ ] Failed delivery falls back to email

**Testing:**
- **Integration:** Approve outreach plan with mixed channels, verify messages dispatched to correct adapters.
- **E2E:** Full flow: build schedule -> contact clients -> approve -> messages sent via correct channels.

**Rollback:** Disable MessageBridge dispatch. Outreach plan still generated but not auto-sent (current behavior).

---

#### Task 7C-1d: Inbound SMS Webhook

**Description:** Handle inbound SMS replies from clients, routing them through the existing `respond-integration` skill.

**New Files:**
- `src/app/api/messaging/twilio/webhook/route.ts` - Receives Twilio inbound SMS webhook. Validates signature. Parses into `NormalizedMessage`. Routes to `respond-integration` skill.

**Acceptance Criteria:**
- [ ] Inbound SMS parsed into `NormalizedMessage` with `platform: 'sms'`
- [ ] Twilio webhook signature validated
- [ ] Client replies routed to `respond-integration` skill
- [ ] Unknown phone numbers logged but not processed (prevents spam)

**Testing:**
- **Unit:** Webhook signature validation. Payload parsing.
- **Integration:** Simulated inbound SMS processed through respond-integration.
- **E2E:** Client replies to SMS, provider sees response in agent chat.

**Rollback:** Disable webhook route. Inbound SMS silently dropped. Outbound SMS unaffected.

---

#### Task 7C-1e: TCPA Compliance for SMS

**Description:** SMS communication requires explicit opt-in under TCPA (Telephone Consumer Protection Act). Add opt-in tracking and enforcement.

**Schema Changes (already included in 7C-1a):**
- `ClientSchema.sms_opt_in: z.boolean().default(false)`

**UI Changes:**
- Client edit form: Add "SMS opt-in" checkbox with consent language: "Client has consented to receive appointment-related text messages."
- Client creation form: Same checkbox, defaults to unchecked.
- Outreach preview: Show warning icon next to clients with `preferred_contact: 'sms'` but `sms_opt_in: false`.

**Inbound "STOP" Handling:**
- In `src/app/api/messaging/twilio/webhook/route.ts`: If inbound message text is "STOP" (case-insensitive), automatically set `sms_opt_in = false` on the matching client and reply with "You have been unsubscribed from text messages."
- Log opt-out event in `agentNotes` for audit trail.

**Acceptance Criteria:**
- [ ] `sms_opt_in` field on ClientSchema, defaults to `false`
- [ ] Client form shows opt-in checkbox with consent language
- [ ] `contact-clients` skill never routes SMS to clients with `sms_opt_in === false`
- [ ] Inbound "STOP" automatically opts out the client
- [ ] Opt-out confirmation reply sent
- [ ] Opt-out event logged for audit

**Testing:**
- **Unit:** STOP message parsing (case variations: "stop", "STOP", "Stop"). Opt-in check in channel resolution.
- **Integration:** Send "STOP" via webhook, verify client `sms_opt_in` set to false. Subsequent outreach routes to email.
- **E2E:** Client receives SMS, replies "STOP", verify no further SMS sent, email used instead.

**Rollback:** If TCPA logic has issues, disable SMS channel entirely (all clients route to email). Safe default.

---

#### Task 7C-1f: Twilio Setup -- Managed Provisioning (Acknowledged Contradiction)

**Description:** Twilio requires an Account SID and Auth Token to function. This directly contradicts Principle #1 ("no API key friction"). Two paths forward:

**Path A (Recommended for v1): Provider-managed Twilio.** KE Agenda provisions a shared Twilio sub-account or phone number pool. Users on the Pro plan get a provisioned number automatically. SMS costs are bundled into the Pro subscription. Users never see Twilio credentials.

**Path B (Fallback): Self-service Twilio.** Settings page includes Twilio SID/Token fields. Contradicts Principle #1 but ships faster. Acceptable only if Path A proves infeasible within the phase timeline.

**The contradiction is acknowledged:** Unlike OpenRouter (which we can fully abstract), Twilio phone numbers have regulatory requirements (phone number verification, A2P 10DLC registration for US SMS). Path A requires upfront investment in Twilio sub-account infrastructure. If Path A is not feasible for v1, Path B ships with a guided setup wizard and a TODO to migrate to Path A.

**Acceptance Criteria:**
- [ ] Pro users get a provisioned SMS number with zero credential setup (Path A) OR
- [ ] Settings page provides guided Twilio setup with validation (Path B, with migration plan to Path A)
- [ ] Decision documented: which path was chosen and why

**Testing:**
- **Integration:** Phone number provisioning (Path A) or credential validation (Path B).
- **E2E:** User enables SMS, sends first message successfully.

**Rollback:** SMS feature disabled. Email and Telegram continue working.

---

#### Task 7C-2: Editable Email Templates

**Description:** Users want to preview and edit the email content before the agent sends booking invitations. Current templates in `src/lib/email/templates.ts` are hardcoded.

**Schema Changes:**
- New collection `EmailTemplateSchema`:
  ```
  template_key: z.enum(['booking_invitation', 'booking_confirmation', 'booking_reminder', 'weather_reschedule', 'custom'])
  subject: z.string()
  body_html: z.string()
  body_text: z.string()
  variables: z.array(z.string())  // e.g., ['clientName', 'serviceName', 'dateTime', 'bookingLink']
  is_default: z.boolean().default(false)
  ```
- Add to `collections` map as `emailTemplates: collection(EmailTemplateSchema)`

**UI Changes:**
- Settings > Templates page: List all templates with preview/edit
- Template editor with variable insertion toolbar (click to insert `{{clientName}}`, etc.)
- Agent outreach flow: Before sending, show "Preview & Edit" step with the rendered template for each client

**Acceptance Criteria:**
- [ ] Default templates seeded on first use (matching current hardcoded templates)
- [ ] User can edit subject and body of any template
- [ ] Variable placeholders render correctly in preview
- [ ] Agent shows template preview before sending outreach
- [ ] Reset to default option available per template

**Testing:**
- **Unit:** Template variable substitution. Default template seeding logic.
- **Integration:** Edit template in UI, verify outreach uses edited version.
- **E2E:** Edit booking invitation template -> trigger outreach -> preview shows custom template.

**Rollback:** Fall back to hardcoded templates in `src/lib/email/templates.ts`. Template collection data preserved.

---

### Phase 7D: Weather Intelligence (P2)

**Goal:** Make weather integration proactive and configurable.

#### Task 7D-1: Proactive Weather Rescheduling Skill

**Description:** New agent skill that monitors weather forecasts for upcoming outdoor appointments and proactively suggests rescheduling. "Wednesday looks bad for outdoor sessions -- want me to shift Megan's lesson to Thursday?"

**Proactive Trigger Mechanism:**

The weather check is NOT a cron job (stays local-first). It fires on the **first dashboard load each calendar day**:

1. **Trigger location:** `src/app/dashboard/page.tsx` (or a `useWeatherAlert` hook mounted in the dashboard layout).
2. **Logic:**
   - On mount, check `localStorage` key `weather_alert_last_check` for today's date.
   - If already checked today, skip.
   - If not checked today:
     a. Query Tomorrow.io forecast for the next 5 days via existing `/api/weather/forecast` endpoint.
     b. Cross-reference forecast with appointments that have `weather_dependent = true` services.
     c. Apply user's configurable thresholds from `BusinessProfile` (temp, wind, precip).
     d. If any appointments are threatened, surface an **alert banner** at the top of the dashboard: "Weather alert: 3 outdoor appointments may be affected this week. [Review]"
     e. Clicking "Review" opens the agent chat with a pre-filled prompt: "Check weather for my outdoor appointments this week."
     f. The `weather-reschedule` skill then runs, producing specific reschedule suggestions.
   - Set `weather_alert_last_check` to today's date.

3. **Code location:** New hook `src/hooks/use-weather-alert.ts` (client-side trigger). Skill logic in `src/lib/agent/skills/weather-reschedule.ts` (runs when user engages via chat).

**New Files:**
- `src/lib/agent/skills/weather-reschedule.ts` - New L2 skill that cross-references weather forecasts with `weather_dependent` services in the upcoming schedule.
- `src/hooks/use-weather-alert.ts` - Dashboard-mounted hook that checks once per day and surfaces banner.

**Skill Design:**
- Queries Tomorrow.io forecast for the service area
- Identifies appointments with `weather_dependent = true` services where forecast exceeds thresholds
- Proposes alternative slots on nearby days with acceptable weather
- Presents as suggestions, never auto-moves

**Schema Changes:**
- Extend `BusinessProfileSchema` with configurable weather thresholds:
  - `weather_max_temp_f: z.number().default(95)` (Andre's "95 isn't hot in Texas" feedback)
  - `weather_min_temp_f: z.number().default(32)`
  - `weather_max_wind_mph: z.number().default(20)`
  - `weather_max_precip_pct: z.number().default(40)`

**UI Changes:**
- Settings > Weather: Configurable thresholds with sliders
- Dashboard: Weather alert banner (amber) when outdoor appointments are threatened
- Agent chat: Weather reschedule suggestions appear as actionable cards with "Move" / "Keep" buttons
- Calendar: Enhanced weather badges showing severity level

**Acceptance Criteria:**
- [ ] Weather check fires once per day on first dashboard load (not a cron, not on every load)
- [ ] Alert banner surfaces when outdoor appointments have bad forecasts
- [ ] Clicking banner opens chat with weather-reschedule skill
- [ ] Agent proactively identifies weather-threatened outdoor appointments
- [ ] Suggestions include specific alternative slots
- [ ] User can accept, reject, or modify each suggestion individually
- [ ] Weather thresholds configurable per business profile
- [ ] Andre's 95F threshold in Austin does not trigger alerts; Megan's 95F in Aiken does (different defaults based on region or manual config)

**Testing:**
- **Unit:** Threshold comparison logic. Alert-already-checked-today guard. Forecast-to-appointment matching.
- **Integration:** Mock forecast with bad weather, verify banner appears. Verify skill generates correct alternative slots.
- **E2E:** Set low thresholds -> load dashboard -> banner appears -> click review -> chat opens with suggestions.

**Rollback:** Disable `useWeatherAlert` hook (weather check stops). Existing weather badges on calendar remain. Skill still callable manually via chat.

---

#### Task 7D-2: "None of These Work" Alternative Time Suggestions

**Description:** On the booking page (`src/app/book/[token]/slot-picker.tsx`), the "None of these work" flow currently captures a free-text decline reason via a textarea (existing implementation in `BookingSlotPicker` component). This task enhances that flow to additionally show agent-generated alternative time suggestions after the client submits their reason.

**Skill Modifications:**
- `src/lib/agent/skills/build-schedule.ts` (or new helper) - Given a client's availability text and current schedule, generate 3-5 alternative slots that fit both the client's stated preferences and the provider's open windows.

**API Changes:**
- `src/app/api/book/alternatives/route.ts` - New endpoint that takes a booking token + availability text, returns suggested alternative slots.

**UI Changes:**
- `src/app/book/[token]/slot-picker.tsx` - After "None of these work" text submission, show a "Finding alternatives..." state, then display new suggested slots. Client can pick one or submit another text response.

**Acceptance Criteria:**
- [ ] After declining all slots and submitting availability text, client sees AI-suggested alternatives within 5 seconds
- [ ] Alternatives respect provider's blocked time and existing appointments
- [ ] Client can confirm an alternative slot directly
- [ ] If no alternatives found, graceful fallback to current "provider will reach out" message

**Testing:**
- **Unit:** Alternative slot generation respects blocked time and existing appointments.
- **Integration:** Submit availability text via API, verify returned slots are valid and non-conflicting.
- **E2E:** Client declines all slots, types "I'm free Thursday afternoon", sees Thursday afternoon alternatives.

**Rollback:** Remove alternative slot UI. Revert to current free-text-only flow. No data loss.

---

### Phase 7E: Data Enrichment + Billing (P2/P3)

**Goal:** Surface useful data that was previously hidden or missing. Add Stripe billing infrastructure.

#### Task 7E-1: Last Appointment Date on Client Cards

**Description:** Simple but high-impact: show when each client was last seen.

**UI Changes:**
- `src/app/dashboard/clients/page.tsx` (client list) - Add "Last seen: Mar 12" or "Never" to each client card.
- Query: find most recent `completed` appointment per client, display as relative date.

**Acceptance Criteria:**
- [ ] Client list shows last completed appointment date
- [ ] "Never" shown for clients with no completed appointments
- [ ] Date updates when appointments are completed

**Testing:**
- **Unit:** Relative date formatting.
- **E2E:** Complete an appointment, verify "Last seen" updates on client card.

**Rollback:** Remove "Last seen" display. No data changes.

---

#### Task 7E-2: Service-to-Pet Linking for Multi-Animal Clients

**Description:** Devon's grooming clients often have multiple pets needing different services. Link services to specific pets so the agent knows "Fluffy gets a full groom, Rex just gets a nail trim."

**Schema Changes:**
- New collection `ClientServicePreferenceSchema`:
  ```
  client_id: z.string().uuid()
  pet_id: z.string().uuid().nullable().optional()
  service_id: z.string().uuid()
  notes: z.string().nullable().optional()
  price_override_cents: z.number().int().nullable().optional()
  ```
- Add to `collections` as `clientServicePreferences: collection(ClientServicePreferenceSchema)`

**UI Changes:**
- Client detail page: "Services & Pets" section showing which pet gets which service
- Appointment creation: When client is selected and has pets, show pet-service quick-pick based on preferences

**Acceptance Criteria:**
- [ ] User can link specific services to specific pets on a client
- [ ] Appointment creation pre-selects service when pet is chosen (and vice versa)
- [ ] Agent's `build-schedule` respects pet-service mappings
- [ ] Price override per client-pet-service supported

**Testing:**
- **Unit:** Pet-service preference lookup. Price override resolution.
- **Integration:** Create preference, verify appointment creation UI uses it.
- **E2E:** Link "Full Groom" to "Fluffy", create appointment for Fluffy, verify service pre-selected.

**Rollback:** Remove preferences collection queries. Appointment creation works as before (manual selection).

---

#### Task 7E-3: Revenue Tracking Per Client

**Description:** Monthly revenue breakdown by client, surfaced on client detail pages and dashboard.

**UI Changes:**
- Client detail page: "Revenue" section showing last 3 months of completed appointment revenue
- Dashboard: Enhance existing revenue card to show top 5 clients by revenue

**Acceptance Criteria:**
- [ ] Client detail shows monthly revenue from completed appointments
- [ ] Dashboard revenue card has drill-down showing top clients
- [ ] Calculations use `price_cents` from linked service (or override from preferences)

**Testing:**
- **Unit:** Revenue aggregation logic (handles price overrides, missing prices, date ranges).
- **E2E:** Complete appointments with known prices, verify revenue totals match.

**Rollback:** Remove revenue sections from UI. No data changes.

---

#### Task 7E-4: Session Notes Tied to Appointments

**Description:** The `AppointmentSchema` already has `notes` (client-visible) and `internal_notes` (private). Ensure the UI makes both fields accessible at appointment completion time.

**UI Changes:**
- Appointment completion flow: When marking an appointment `completed`, show a notes panel with both `notes` (shared with client) and `internal_notes` (private).
- Client detail page: Show appointment history with notes timeline.

**Acceptance Criteria:**
- [ ] Completion flow prompts for notes
- [ ] Notes visible in appointment history on client detail page
- [ ] Internal notes never shown on client portal or in client-facing communications

**Testing:**
- **Unit:** Notes visibility rules (internal_notes excluded from client-facing contexts).
- **E2E:** Complete appointment with both note types, verify visibility on client detail vs. portal.

**Rollback:** Remove notes panel from completion flow. Notes fields still exist on schema.

---

#### Task 7E-5: Stripe Billing Integration (Moved from 7A)

**Description:** Add Stripe subscription billing to monetize the Pro tier. Decoupled from API key provisioning (Task 7A-1a) so billing complexity does not block P0 conversion.

**Prerequisites:** Task 7A-1a (server-managed keys) must be complete. Users are already using the product on the free tier.

**TierConfig Migration:** Extend `src/lib/agent/tier.ts`:
- Change `TierConfig.name` from `'free' | 'paid'` to `'free' | 'trial' | 'pro'`
- Add `TRIAL_TIER` config (same limits as Pro, 14-day expiry)
- Update `BusinessProfileSchema.subscription_tier` to `z.enum(['free', 'trial', 'pro']).default('free')`
- Migrate existing `'paid'` values to `'pro'` via OfflineKit migration function

**Schema Changes:**
- Extend `BusinessProfileSchema` with:
  - `stripe_customer_id: z.string().nullable().optional()`
  - `subscription_status: z.enum(['active', 'past_due', 'cancelled', 'trialing']).nullable().optional()`
  - `trial_ends_at: z.string().datetime().nullable().optional()`

**New Files:**
- `src/lib/billing/stripe-client.ts` - Stripe SDK wrapper (server-only)
- `src/lib/billing/subscription.ts` - Plan definitions, trial logic, usage limits
- `src/lib/billing/usage-meter.ts` - Track token consumption per user per billing period
- `src/app/api/billing/webhook/route.ts` - Stripe webhook handler
- `src/app/api/billing/checkout/route.ts` - Create checkout session
- `src/app/api/billing/portal/route.ts` - Customer portal redirect
- `src/app/dashboard/settings/billing/page.tsx` - Plan selection, usage bar, manage subscription

**UI Changes:**
- Settings page gets a "Plan & Billing" tab showing current plan, usage meter, upgrade/downgrade buttons
- 14-day trial auto-starts on signup with Pro features
- Usage indicator in sidebar reflects billing period

**Acceptance Criteria:**
- [ ] Pro tier uses `anthropic/claude-3.5-sonnet` with 500K tokens/month
- [ ] 14-day trial auto-starts on signup with Pro features
- [ ] Stripe webhook correctly handles subscription lifecycle events (subscribe, cancel, past_due, trial_end)
- [ ] Usage meter shows tokens consumed vs. limit with warning at 80%
- [ ] Downgrade to free tier preserves all data, reduces AI budget
- [ ] TierConfig values consistent: code uses same enum values as schema

**Testing:**
- **Unit:** Subscription lifecycle state machine. Usage limit enforcement. Tier migration (`'paid'` -> `'pro'`).
- **Integration:** Stripe webhook handling (use Stripe CLI for local testing). Checkout session creation. Customer portal redirect.
- **E2E:** Signup -> trial starts -> use AI features -> trial expires -> downgrade to free -> upgrade to Pro via Stripe.

**Rollback:** Disable Stripe routes. All users remain on free tier with server-managed keys (7A-1a). No revenue but product remains functional.

---

## 4. OfflineKit Schema Migration Strategy

All schema changes in this PRD follow these rules:

1. **All new fields MUST be `.optional()` or have `.default()`** -- this ensures existing documents pass Zod validation after schema changes.

2. **Verify mpb-localkit `.default()` behavior:** Before implementation, write a test that:
   - Creates a document with the current schema (no new fields)
   - Updates the schema to include a new field with `.default()`
   - Reads the existing document
   - Asserts the default value is present on the read result

   If this test passes, no migration step is needed. If it fails, proceed to step 3.

3. **If mpb-localkit does NOT apply defaults on read:** Add a migration function in `src/lib/offlinekit/index.ts`:
   ```
   async function migrateDocuments() {
     // For each collection with new fields:
     // 1. Read all documents
     // 2. For any document missing new fields, write it back (Zod parse will apply defaults)
     // 3. Run once on app startup, guard with a version flag in localStorage
   }
   ```

4. **Test with existing beta user data:** Before deploying any phase, load a snapshot of existing beta data and verify all documents parse without errors after schema changes.

5. **New collections** (RecurrenceRuleSchema, BlockedTimeSchema, EmailTemplateSchema, ClientServicePreferenceSchema) need no migration -- they start empty.

---

## 5. Schema Changes Summary

### Modified Collections

| Collection | New Fields | Phase | Default/Optional |
|-----------|-----------|-------|------------------|
| `BusinessProfileSchema` | `subscription_tier`, `openrouter_key_ref`, `tier_verified_at`, `onboarding_completed`, `business_type`, `twilio_phone_number`, `weather_max_temp_f`, `weather_min_temp_f`, `weather_max_wind_mph`, `weather_max_precip_pct` | 7A, 7C, 7D | All `.default()` or `.nullable().optional()` |
| `BusinessProfileSchema` | `stripe_customer_id`, `subscription_status`, `trial_ends_at` | 7E | All `.nullable().optional()` |
| `ClientSchema` | `preferred_contact`, `sms_opt_in` | 7C | Both have `.default()` |
| `NormalizedMessage.platform` (type) | `'sms'`, `'email'` added to union | 7C | N/A (type change) |

### New Collections

| Collection | Purpose | Phase |
|-----------|---------|-------|
| `RecurrenceRuleSchema` | Client recurring appointment intervals | 7B |
| `BlockedTimeSchema` | Personal commitments, blocked calendar time | 7B |
| `EmailTemplateSchema` | Editable email templates | 7C |
| `ClientServicePreferenceSchema` | Pet-service linking with price overrides | 7E |

---

## 6. New Skills Summary

| Skill | Tier | Phase | Description |
|-------|------|-------|-------------|
| `weather-reschedule` | L2 | 7D | Proactive weather monitoring and reschedule suggestions |

### Modified Skills

| Skill | Change | Phase |
|-------|--------|-------|
| `build-schedule` | Respect recurrence rules and blocked time | 7B |
| `contact-clients` | Multi-channel routing (email/SMS/Telegram), TCPA compliance | 7C |
| `respond-integration` | Handle individual confirmations, SMS inbound | 7B, 7C |
| `digest` | Include weather reschedule alerts | 7D |

---

## 7. UI Changes Summary

### New Pages
- `/dashboard/settings/billing` - Plan & billing management (Phase 7E)
- `/dashboard/settings/templates` - Email template editor

### New Components
- `src/components/onboarding/` - 4-step onboarding wizard
- `src/components/clients/recurrence-form.tsx` - Recurring schedule form
- `src/components/calendar/blocked-time-form.tsx` - Block time entry
- `src/hooks/use-weather-alert.ts` - Daily weather check hook (dashboard-mounted)
- Settings weather threshold sliders

### Modified Components
- Dashboard page - Onboarding detection, revenue drill-down, weather alert banner
- Calendar view - Blocked time gray zones, enhanced weather badges
- Client detail page - Recurrence rules, last seen, revenue, service-pet links
- Client form - Preferred contact channel, SMS opt-in checkbox with consent language
- Booking slot picker - Alternative time suggestions
- Draft appointment list - Individual confirm/decline buttons
- Settings page - Billing tab, messaging tab, weather tab

---

## 8. ADR: Server-Managed Keys Decoupled from Billing

**Decision:** Decouple API key provisioning (ships immediately) from Stripe billing (ships in Phase 7E). Server provisions OpenRouter keys at signup. Free tier with budget limit. Billing follows independently.

**Drivers:**
1. All 3 beta testers flagged API key setup as a deal-breaker
2. Product must feel like a scheduling tool, not a developer tool
3. Stripe integration is 1-2 weeks of work that should not block the P0 fix
4. Existing `TierConfig` uses `'free' | 'paid'` -- extending to `'trial' | 'pro'` is a billing concern, not a key provisioning concern

**Alternatives Considered:**
- **Bundled key + billing (Option B)** - Viable but delays P0 fix by 1-2 weeks. Deferred to Phase 7E.
- **BYOK with wizard (Option C)** - Invalidated by unanimous tester feedback.
- **Hybrid BYOK + managed** - Viable but deferred; adds complexity with no current demand for a developer tier.

**Why Chosen:** Eliminates the #1 conversion blocker in the shortest possible time. Users sign up and use. No external accounts, no key management, no concept leakage. Billing is layered on top later without re-architecture.

**Consequences:**
- Must manage per-user key provisioning and budget enforcement without billing
- Free tier must remain functional (limited but not crippled)
- Must implement offline degradation for tier verification (7-day grace, then free-tier fallback)
- Stripe billing (7E-5) must handle migration from `'free'/'paid'` to `'free'/'trial'/'pro'`

**Follow-ups:**
- Usage analytics dashboard for business intelligence (internal)
- Cost optimization: model routing based on task complexity (use cheaper models for simple tasks)
- Consider annual billing discount after 3 months of data

---

## 9. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Key provisioning pool exhaustion | Low | High | Monitor pool size. Alert at 80% capacity. Pre-provision keys in batches. |
| Stripe integration delays (7E-5) | Medium | Medium | Decoupled from P0. Product works without billing. Ship when ready. |
| Twilio SID/token contradicts Principle #1 | High | Medium | Path A (managed provisioning) preferred. Path B (self-service) as fallback with migration plan. Contradiction acknowledged in 7C-1f. |
| TCPA compliance gaps | Medium | High | Conservative default: `sms_opt_in = false`. Never send SMS without explicit opt-in. STOP handling mandatory. |
| Offline tier degradation confuses users | Low | Medium | Clear UI messaging: "Operating in offline mode. Some features may be limited." Grace period (7 days) covers most real-world offline scenarios. |
| OfflineKit schema migration breaks existing data | Medium | High | All new fields `.optional()` or `.default()`. Migration test with beta data before deploy. See Section 4. |
| Twilio SMS costs surprising users | Medium | Medium | Show estimated SMS cost before sending. Cap monthly SMS on free tier. |
| Weather API rate limits with proactive monitoring | Low | Medium | Check once per day per user (not per page load). Batch forecast requests per region, cache aggressively (existing 30-min cache). |
| Onboarding wizard feels too long | Low | Medium | Every step is skippable. Max 4 steps, each under 30 seconds. |
| Recurring rules creating schedule conflicts | Medium | Medium | Agent validates against blocked time and existing appointments before proposing. Surface conflicts in UI. |

---

## 10. Success Metrics

| Metric | Current | Target | Phase |
|--------|---------|--------|-------|
| Signup-to-first-schedule completion | Unknown (blocked by API key) | >60% within first session | 7A |
| Onboarding wizard completion rate | N/A | >75% | 7A |
| Client communication response rate | ~50% (email only) | >70% (with SMS) | 7C |
| Weather-related last-minute cancellations | Baseline TBD | -40% reduction | 7D |
| Draft confirmation rate (individual) | Batch-only | >85% per-appointment | 7B |

---

## 11. Implementation Order & Dependencies

```
Phase 7A (Week 1): MUST ship first - unblocks all other work
  7A-1a: Server-Managed API Keys (1-3 days)
  7A-2: Onboarding Wizard (3-5 days, can start in parallel with 7A-1a)

Phase 7B (Week 2-3): Core scheduling
  7B-1: Recurrence Rules (independent)
  7B-2: Blocked Time (independent)
  7B-3: Individual Draft Confirm (independent)

Phase 7C (Week 3-5): Communication (sub-tasks are sequential)
  7C-1a: Twilio SMS Adapter (+ NormalizedMessage type extension)
  7C-1b: contact-clients skill refactor (depends on 7C-1a)
  7C-1c: MessageBridge integration (depends on 7C-1b)
  7C-1d: Inbound SMS webhook (depends on 7C-1a)
  7C-1e: TCPA compliance (parallel with 7C-1b)
  7C-1f: Twilio setup/provisioning (parallel with 7C-1a)
  7C-2: Editable Templates (independent of 7C-1x)

Phase 7D (Week 5-6): Weather intelligence
  7D-1: Proactive Weather Skill + trigger hook (depends on 7B-2 for blocked time awareness)
  7D-2: Booking Alternatives (independent)

Phase 7E (Week 6-8): Data enrichment + billing
  7E-1 through 7E-4 are all independent, can parallelize
  7E-5: Stripe Billing (depends on 7A-1a being stable; extends TierConfig)
```

---

## 12. Open Questions

See `.omc/plans/open-questions.md` for tracked items.
