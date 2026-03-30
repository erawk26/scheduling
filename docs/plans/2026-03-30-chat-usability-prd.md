# PRD: Chat Appointment Management — Usability Testing & Bug Fixes

**Date**: 2026-03-30
**Status**: Draft
**Beads**: ke-agenda-v2-o9i
**Priority**: P1

---

## Problem Statement

User asked the chat agent to "swap an appointment on Monday with Wednesday" and the agent responded that the user only had appointments on Monday — which is false. Seed data has appointments on Monday (4), Tuesday (3), Wednesday (2), and Thursday (3).

Investigation reveals this is not a single bug but a cluster of issues in the adjust skill, context retrieval, and missing "swap" semantics.

---

## Root Cause Analysis

### Bug 1: `getTwoWeekRange()` only looks forward (adjust.ts:15-19)

```typescript
function getTwoWeekRange(): { from: string; to: string } {
  const now = new Date();           // RIGHT NOW, including time
  const end = new Date(now);
  end.setDate(now.getDate() + 14);
  return { from: now.toISOString(), to: end.toISOString() };
}
```

**Impact**: If it's Monday at 2pm and the user says "swap my Monday appointment", any appointment before 2pm is invisible. The LLM correctly reports "you only have appointments on Monday" because it literally cannot see any other day's appointments if the Monday ones are the only ones still in the future window.

**Contrast**: `getFullContext()` uses `getRecentDateRange()` which goes 7 days back AND 7 days forward — the adjust skill bypasses this entirely.

### Bug 2: "Swap" is not a supported operation

The adjust skill's system prompt only defines two JSON actions:
- `{"action": "cancel", ...}`
- `{"action": "reschedule", ...}`

A "swap" requires TWO reschedule operations atomically (move A from Monday→Wednesday AND move B from Wednesday→Monday). The LLM has no way to express this — it can only output a single JSON action block, and `parseAction()` only extracts the first match.

### Bug 3: Date format mismatch in filtering

`getTwoWeekRange()` returns ISO strings with `Z` suffix (e.g., `2026-03-30T14:00:00.000Z`).
Seed data stores times as ISO with `Z` suffix via `toISOString()`.
But `getRecentDateRange()` strips the `Z`: `.replace('Z', '').split('.')[0]`.

The string comparison `apt.start_time >= dateRange.from` can produce inconsistent results when some dates have `Z` and others don't, since `Z` sorts after digits.

### Bug 4: No "current week" awareness

The user says "Monday" and "Wednesday" — they mean THIS week. But:
- Seed data generates for "next Monday" (7 days from generation time)
- The adjust skill has no date resolution logic ("Monday" → specific date)
- The LLM must infer which Monday from the appointment timestamps in context

---

## Requirements

### R1: Fix adjust skill date range (Critical)

**Change**: Replace `getTwoWeekRange()` with a range that matches `getRecentDateRange()` — 7 days back, 14 days forward. This ensures the LLM sees the full picture when reasoning about swaps.

**Acceptance Criteria**:
- [ ] Adjust skill sees appointments from past 7 days through next 14 days
- [ ] Date format is consistent (no Z-suffix mismatch)
- [ ] Past appointments are clearly labeled so LLM doesn't try to reschedule completed ones

### R2: Support compound "swap" action (Critical)

**Change**: Extend the adjust skill to support a `swap` action that moves two appointments simultaneously.

New JSON format:
```json
{
  "action": "swap",
  "appointmentA": { "id": "<uuid>", "newStartTime": "<ISO>", "newEndTime": "<ISO>" },
  "appointmentB": { "id": "<uuid>", "newStartTime": "<ISO>", "newEndTime": "<ISO>" }
}
```

**Acceptance Criteria**:
- [ ] System prompt includes swap action definition
- [ ] `parseAction()` handles swap JSON
- [ ] `applyAction()` updates both appointments atomically
- [ ] Confirmation message names both appointments and their new times
- [ ] Rollback if either update fails

### R3: Improve context serialization for date clarity (Important)

**Change**: Group appointments by day in the prompt so the LLM can clearly see what's on each day.

Current format:
```
- 2026-04-06T08:00:00: Sarah Johnson — Full Groom
- 2026-04-06T10:00:00: David Kim — Nail Trim
```

Proposed format:
```
Monday, April 6:
  8:00 AM — Sarah Johnson — Full Groom (id: 40000000-...)
  10:00 AM — David Kim — Nail Trim (id: 40000000-...)

Wednesday, April 8:
  10:00 AM — David Kim — De-shed Treatment (id: 40000000-...)
  12:00 PM — Lisa Martinez — De-shed Treatment (id: 40000000-...)
```

**Acceptance Criteria**:
- [ ] Appointments grouped by day with human-readable day names
- [ ] Times shown in 12-hour format with AM/PM
- [ ] Appointment IDs visible (LLM needs them for JSON actions)
- [ ] Past days marked as "(past)" so LLM avoids rescheduling into them

### R4: Add confirmation step before destructive actions (Important)

**Change**: Before executing a swap/reschedule, the agent should present a plan and ask for confirmation.

Flow:
1. User: "Swap my Monday appointment with Wednesday"
2. Agent: "Here's what I'll do: Move Sarah's Full Groom from Mon 8am → Wed 8am, and move David's De-shed from Wed 10am → Mon 10am. Confirm?"
3. User: "Yes"
4. Agent executes and confirms

**Acceptance Criteria**:
- [ ] Agent presents proposed changes before executing
- [ ] User must confirm (or cancel)
- [ ] Pending action stored in conversation context (not executed until confirmed)

---

## Usability Test Plan

### Test Environment Setup
1. Fresh seed data via `seedDemoData()`
2. Known date anchor (tests should mock `Date.now()` or use fixed reference)
3. OpenRouter API key configured (or test mode with `X-Test-Response`)

### UT-1: Single Appointment Reschedule

| # | User Message | Expected Behavior | Validates |
|---|---|---|---|
| 1.1 | "Move Sarah's Monday appointment to Friday at 9am" | Identifies Sarah's Mon 8am Full Groom, proposes move to Fri 9am | R1, R3, R4 |
| 1.2 | "Reschedule David's Wednesday appointment to Thursday at 2pm" | Identifies David's Wed 10am De-shed, proposes move to Thu 2pm | R1, R3 |
| 1.3 | "Move my 1pm Monday appointment to Tuesday" | Identifies Lisa's Mon 1pm by time alone (no client name) | R3 |
| 1.4 | Confirm "yes" after 1.1 | Appointment actually moves, confirmation shown | R4 |

### UT-2: Swap Two Appointments Between Days

| # | User Message | Expected Behavior | Validates |
|---|---|---|---|
| 2.1 | "Swap my Monday and Wednesday schedules" | Shows both days' appointments, proposes full-day swap | R2, R3 |
| 2.2 | "Swap Sarah's Monday appointment with David's Wednesday appointment" | Proposes: Sarah Mon→Wed, David Wed→Mon | R2, R4 |
| 2.3 | Confirm "yes" after 2.2 | Both appointments move, both confirmations shown | R2 |
| 2.4 | "Swap Emily's Tuesday with Lisa's Thursday" | Identifies both appointments across different days | R2, R1 |

### UT-3: Edge Cases — Ambiguity and Errors

| # | User Message | Expected Behavior | Validates |
|---|---|---|---|
| 3.1 | "Swap Monday with Wednesday" (no client specified, multiple appointments per day) | Agent asks for clarification: "You have 4 appointments Monday and 2 Wednesday. Which ones?" | R3 |
| 3.2 | "Move Sarah to Wednesday" (Sarah has appointments on Mon AND Tue) | Agent asks: "Sarah has appointments Mon 8am (Full Groom) and Tue 11am (Bath). Which one?" | R3 |
| 3.3 | "Reschedule Mike to Wednesday" (Mike is fixed Tue/Thu only) | Agent warns: "Mike is marked as fixed (Tue/Thu only). Are you sure?" | Client flexibility awareness |
| 3.4 | "Swap Monday morning with Friday" (no appointments on Friday) | Agent: "You don't have any appointments on Friday to swap with." | R2 error handling |
| 3.5 | "Cancel my 3pm Monday appointment" (no 3pm appointment exists) | Agent: "I don't see a 3pm appointment on Monday. Your Monday appointments are: [list]" | R1, R3 |

### UT-4: Context Completeness — The Original Bug

| # | User Message | Expected Behavior | Validates |
|---|---|---|---|
| 4.1 | "What appointments do I have this week?" | Lists all 12 scheduled appointments across Mon-Thu | R1 (date range) |
| 4.2 | "Swap an appointment on Monday with Wednesday" | Agent sees BOTH days, asks which specific appointments | R1, R2, R3 |
| 4.3 | Run UT-4.2 at 3pm Monday (after morning appointments) | Agent still sees all Monday appointments, not just future ones | R1 (critical regression) |
| 4.4 | "Show me Wednesday's appointments" | Shows David 10am De-shed AND Lisa 12pm De-shed | R1 |

### UT-5: Conversation Flow and Recovery

| # | User Message | Expected Behavior | Validates |
|---|---|---|---|
| 5.1 | "Swap Monday with Wednesday" → "Actually, never mind" | Agent acknowledges cancellation, no changes made | R4 |
| 5.2 | "Move Sarah to Wednesday" → "Wait, move her to Thursday instead" | Agent updates proposal to Thursday before executing | R4 |
| 5.3 | Rapid-fire: "Move Sarah to Wed. Also cancel David's Monday." | Agent handles both operations (skill may need to be invoked twice) | Multi-action |

---

## Implementation Priority

| Order | Requirement | Effort | Impact |
|---|---|---|---|
| 1 | R1: Fix date range | Small (1 function) | Critical — fixes the reported bug |
| 2 | R3: Better context serialization | Medium (prompt-builder) | High — reduces LLM confusion |
| 3 | R2: Swap action support | Medium (adjust skill) | High — new capability |
| 4 | R4: Confirmation flow | Large (conversation state) | Medium — safety improvement |

---

## Test Automation Strategy

### Unit Tests (fast, no LLM)
- `getTwoWeekRange()` returns correct range (7 days back, 14 days forward)
- `parseAction()` handles swap JSON
- `applyAction()` handles swap (both appointments updated)
- `applyAction()` rollback on partial failure
- `serializeContext()` groups by day with human-readable format
- Date format consistency (no Z-suffix mismatches in comparisons)

### Integration Tests (mocked LLM)
- Adjust skill receives full week of appointments in context
- Adjust skill with mock LLM returning swap action → both appointments updated
- Adjust skill at "Monday 3pm" still sees Monday morning appointments
- Context provider returns appointments on all days when queried with schedule keywords

### E2E Tests (real UI, mocked API)
- Execute each UT scenario via Playwright
- Use `X-Test-Response` header to control LLM responses
- Verify UI shows correct appointment state after operations
- Screenshot comparison for confirmation dialog

---

## Out of Scope

- Multi-week swap ("swap next Monday with the Monday after")
- Recurring appointment swap patterns
- Undo after confirmation (can be added later)
- Conflict detection (double-booking same time slot)

---

## Success Criteria

All 19 usability tests pass. Specifically:
1. **UT-4.2 (the original bug)**: "Swap an appointment on Monday with Wednesday" → agent sees both days' appointments and responds correctly
2. **UT-4.3 (regression guard)**: Same query at 3pm Monday still works
3. **UT-2.2 (swap works)**: Named swap between two clients executes correctly
4. **UT-3.1 (ambiguity handled)**: Ambiguous swap triggers clarification, not wrong action
