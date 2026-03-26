# Open Questions

## AI Scheduling Agent - 2026-03-21

### Resolved (v2 revision)

- [x] OpenViking SDK availability -- **Resolved:** OpenViking does not exist on npm. Replaced with `ContextProvider` interface. Ships with `StructuredContextProvider` (OfflineKit queries). Semantic search is a future enhancement slot.
- [x] Where do `users` table fields go? -- **Resolved:** New `businessProfile` collection in OfflineKit (one doc per user) holds `business_name`, `phone`, `timezone`, `service_area_miles`, `business_latitude`, `business_longitude`. Separate from `agentProfile`.
- [x] Data migration strategy -- **Resolved:** Greenfield. No migration from existing SQLite data. New product fork for new users.
- [x] Hook migration disposition -- **Resolved:** Full inventory of 17 hooks documented with MIGRATE/REMOVE/KEEP disposition per hook.
- [x] TanStack Query fate -- **Resolved:** Stays for API call caching (`use-weather.ts`, `use-routes.ts`). Removed from all DB CRUD hooks (replaced by OfflineKit `useCollection`).
- [x] Service worker update timing -- **Resolved:** Moved to Phase 1 (Task 1.4). Remove WASM cache references immediately after OfflineKit migration.
- [x] Booking page write path -- **Resolved:** Client selection hits a Next.js API route (`/api/book/confirm`) which writes to OfflineKit via the Cloudflare Worker sync endpoint (server-side). Client has no OfflineKit instance.
- [x] Branch strategy -- **Resolved:** `feature/agent-rebuild` long-lived feature branch off `main`.
- [x] Testing approach -- **Resolved:** Each phase now has a testing section specifying unit/integration/e2e tests and tools.
- [x] Context pipeline specifics -- **Resolved:** StructuredContextProvider uses OfflineKit reactive queries. No separate re-indexing step. Context refreshes when OfflineKit data changes (reactive). Performance target: <500ms on mobile.
- [x] OpenViking re-indexing performance -- **Resolved:** N/A. OpenViking replaced with StructuredContextProvider. Performance target is on OfflineKit queries, not re-indexing.
- [x] Agent conversation history storage -- **Resolved:** Separate `agentConversations` collection. Not mixed with `agentNotes`.
- [x] `agentProfile` schema structure -- **Resolved:** 7 per-section documents keyed by section ID, not one monolithic doc.

### Open (still pending)

- [ ] Messaging platform integration approach (build vs. Twilio/MessageBird) -- Blocks Phase 5; research should start during Phase 3
- [ ] Email provider selection (Resend, SendGrid, Postmark) -- Blocks Phase 4.1; decision needed before client communication work begins
- [ ] Product name -- Does not block implementation but affects branding on booking page and emails
- [ ] Pricing specifics (free vs. paid tier boundaries) -- Blocks Phase 6.1 tier enforcement; model cost analysis needed
- [ ] Client contact channel research (email vs. WhatsApp Business API vs. other) -- Email is the Phase 4 default; other channels are Phase 5
- [ ] On-device LLM feasibility for privacy-sensitive users -- Future exploration, does not block any phase
- [ ] OfflineKit package name confirmation -- README shows `mpb-localkit` as the npm package name. Confirm this is the correct/current package name before Phase 1
- [ ] OpenRouter streaming support -- Agent chat streams responses; need to confirm OpenRouter SDK supports streaming and how to integrate with React state
- [ ] Booking page token strategy details -- JWT with short expiry decided, but need to determine: exact expiry duration (48h proposed), single-use enforcement (server-side lookup or stateless?), revocation mechanism
- [ ] StructuredContextProvider keyword matching implementation -- Simple substring match? Stemming? How sophisticated does keyword matching on notes need to be for v1?
- [ ] Concurrent message handling UX -- Plan specifies queue-based processing (one at a time). Need to validate this UX with real usage -- does the user feel blocked when a second message queues?

## V7 Focus Group Cycle - 2026-03-25 (Revised v2)

### Resolved (v2 revision)

- [x] Stripe billing blocking P0 conversion -- **Resolved:** Decoupled. Task 7A-1a provisions server-managed API keys immediately. Stripe billing moved to Task 7E-5 (Phase 7E). No billing dependency on P0.
- [x] Twilio vs. managed SMS -- **Resolved:** Path A (managed provisioning for Pro users) is preferred. Path B (self-service SID/token) is fallback. Contradiction with Principle #1 acknowledged in Task 7C-1f.
- [x] Offline tier degradation -- **Resolved:** Cache tier in BusinessProfile. 7-day grace period. Free-tier fallback when grace expires. Re-verify on reconnect. See Task 7A-1a.
- [x] TierConfig alignment ('free'|'paid' vs 'free'|'trial'|'pro') -- **Resolved:** 7A-1a keeps existing 'free'|'paid'. 7E-5 extends to 'free'|'trial'|'pro' when Stripe ships. Migration from 'paid' to 'pro' handled in 7E-5.
- [x] NormalizedMessage.platform missing 'sms'|'email' -- **Resolved:** Extended in Task 7C-1a.
- [x] contact-clients skill scoping -- **Resolved:** Broken into sub-tasks 7C-1a through 7C-1f (adapter, skill refactor, bridge integration, inbound webhook, TCPA, Twilio setup).
- [x] TCPA compliance for SMS -- **Resolved:** `sms_opt_in` field on ClientSchema, consent language in UI, STOP handling in webhook. See Task 7C-1e.
- [x] Proactive weather trigger mechanism -- **Resolved:** `useWeatherAlert` hook fires on first dashboard load each day, checks localStorage guard, surfaces banner + chat prompt. NOT a cron. See Task 7D-1.
- [x] OfflineKit schema migration strategy -- **Resolved:** All new fields `.optional()` or `.default()`. Verify mpb-localkit applies defaults on read. Migration function in offlinekit/index.ts if not. Test with beta data. See Section 4.
- [x] Testing sections per phase -- **Resolved:** Each task now has Unit/Integration/E2E testing sections.
- [x] Rollback plans per phase -- **Resolved:** Each task now has a Rollback section.

### Open (still pending)

- [ ] Stripe pricing structure -- $12/month proposed for Pro tier. Need cost analysis: average token consumption per user per month vs. OpenRouter costs to validate margin. Free tier token budget (50K) may need adjustment. (Deferred to Phase 7E)
- [ ] Trial duration and conversion flow -- 14-day trial proposed. Need to decide: what happens at trial end? Hard cutoff to free tier? Grace period? Downgrade warning cadence? (Deferred to Phase 7E)
- [ ] Email template editor complexity -- Full HTML editor (heavy) or structured blocks (lighter)? Focus group didn't specify. Recommend structured blocks with variable insertion for v1.
- [ ] Regional weather defaults -- Andre says 95F is normal in Austin. Should business_type or zip code auto-set weather thresholds? Or always manual? Manual is simpler; auto-defaults are better UX.
- [ ] SMS cost pass-through model -- Does Pro subscription include SMS, or is it billed separately per message? Twilio charges ~$0.0079/segment. At 42 clients (Devon), weekly outreach = ~$0.33/week. Low but needs transparency. (Deferred to Phase 7E)
- [ ] iMessage delivery via Twilio -- Twilio SMS delivers to iMessage on Apple devices automatically, but does not support iMessage-specific features (read receipts, rich cards). Is plain SMS sufficient for v1?
- [ ] Booking page alternative slot generation latency -- AI-generated alternatives must complete within 5 seconds. Need to validate this is achievable with the free-tier model (gemma-2-9b). May need to use a faster model for this specific endpoint.
- [ ] Recurrence rule conflict resolution -- When a recurring rule says "Thursday" but Thursday is fully booked, should the agent: (a) suggest the nearest available day, (b) skip that week, or (c) ask the user? Recommend (a) with notification.
- [ ] Product name decision -- Still unresolved from prior cycle. Affects onboarding wizard copy, email templates, booking page branding. Does not block implementation but should be decided before 7A-2 ships.
- [ ] mpb-localkit .default() behavior verification -- Must confirm whether mpb-localkit applies Zod `.default()` on document read before Phase 7A implementation begins. Blocks migration strategy decision.
- [ ] Twilio A2P 10DLC registration -- US SMS requires A2P 10DLC campaign registration for business messaging. Timeline: 2-4 weeks for approval. Must start registration during Phase 7B to be ready for Phase 7C.
- [ ] OpenRouter key pool sizing -- How many pre-provisioned keys to maintain? What's the provisioning latency for new keys? Blocks Task 7A-1a implementation details.
