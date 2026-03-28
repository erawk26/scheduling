## AI Chat Window — Acceptance Criteria

---

### 1. Message Input

**Given** the user opens the app
- The input field is focused and ready to type without any additional taps
- Sending via Enter (desktop) or Send button (mobile) submits the message
- Input field expands vertically up to 4 lines before scrolling internally
- Empty or whitespace-only messages cannot be submitted (button disabled, Enter does nothing)
- Messages up to 1,000 characters are accepted; anything longer shows a character count warning at 900 and hard-blocks at 1,000
- After sending, the field clears immediately and focus returns to input

---

### 2. Message History / Conversation Thread

**Given** the user has prior conversations
- Messages are displayed in chronological order, oldest at top
- User messages are visually distinct from agent messages (alignment, color, or avatar)
- Timestamps are shown on every message at minimum as relative time ("2 min ago"); tapping reveals absolute time
- The thread auto-scrolls to the latest message on new content
- If the user has scrolled up, a "New message" badge appears and tapping it jumps to bottom
- History persists across app closes and device restarts (local-first storage)
- History loads the last 50 messages instantly; older messages paginate on scroll-up with no blank flash

---

### 3. AI "Thinking" / Processing State

**Given** the user sends a message
- A typing indicator (or equivalent) appears within 300ms of sending
- If the agent takes longer than 3 seconds, a status message appears ("Checking your calendar..." or similar) to confirm it's still working
- If processing exceeds 15 seconds, the user sees an explicit "This is taking longer than usual" message
- The input field is disabled while a response is pending (prevents duplicate sends)
- Once a response arrives, the indicator disappears and the response renders fully before the input re-enables

---

### 4. Inline Schedule Preview Cards

**Given** the agent proposes a schedule change, creates a booking, or summarizes a week
- The agent's response includes a structured card (not just prose) showing: client name, date, time, address, duration
- Cards for conflicting or changed appointments are visually flagged (color, icon)
- The card has a single-tap "Confirm" and "Edit" action
- Tapping "Edit" opens an inline edit view within the chat, not a separate screen
- Cards render correctly on screens 320px wide and up
- If the schedule spans multiple days, cards are grouped by day with a clear separator

---

### 5. Confirmation / Disambiguation Prompts

**Given** the agent receives an ambiguous instruction ("move my afternoon", "reschedule Johnson")
- The agent asks exactly one clarifying question, not a list of five
- The clarifying question offers tappable options where the answer set is bounded (e.g., two client Johnsons → show both as chips)
- The user can ignore the prompt and keep typing; the agent re-attempts interpretation with additional context
- If the agent makes an assumption instead of asking, it states the assumption explicitly ("I'm treating this as Mrs. Johnson from Oak St — let me know if that's wrong")
- The user can correct a misinterpretation in plain text ("no, the other one") and the agent resolves it without re-asking

---

### 6. Quick Suggestion Chips

**Given** context where common follow-up actions are predictable
- 2–4 suggestion chips appear below agent messages when applicable (e.g., "Confirm all", "Show this week", "Undo")
- Chips disappear after the user sends their next message
- Chips are never the only way to do something — all chip actions can also be typed
- Tapping a chip sends it as a message so the action is visible in history, not invisible

---

### 7. Offline Mode

**Given** the device has no network connection
- The chat window shows a persistent, non-blocking offline banner ("Offline — changes will sync when connected")
- The user can still send messages; they are queued locally with a visual indicator (clock icon, "pending" state)
- The agent responds using cached data and local model — responses are clearly labeled "Offline response" so the user knows real-time client data wasn't checked
- Queued messages and their responses sync automatically when connectivity returns, in the order they were sent
- If the device has been offline for more than 72 hours, the user gets a warning that some data (client availability, weather) may be stale
- Offline state never causes a crash, spinner hang, or blank screen

---

### 8. Sync Status Indicator

**Given** the user is on any device
- A sync status icon is visible in the chat header or status bar at all times (synced, syncing, offline, error)
- "Synced" state shows the last sync timestamp
- "Error" state shows a human-readable reason and a retry button
- Sync conflicts (same appointment edited on two devices) surface as a resolution prompt in the chat thread, not a silent overwrite
- After resolving a conflict, the winning state is confirmed in-chat

---

### 9. System / Agent-Initiated Messages

**Given** the agent takes an action autonomously (sends a client booking link, gets a confirmation back, detects a weather conflict)
- The agent proactively sends a message without the user prompting — these are visually distinguishable from responses (e.g., labeled "Update" or "Alert")
- Client confirmations received appear as a message: "Mrs. Johnson confirmed Wednesday 10am"
- Client declines or no-responses surface as actionable prompts: "No response from Mr. Davis — reschedule or follow up?"
- Weather conflicts surface before the affected day with enough lead time to act (at minimum 12 hours prior)
- The user can disable categories of proactive messages in settings; disabling a category doesn't suppress confirmations or conflicts

---

### 10. Error States

**Given** the agent fails to process a message (network timeout, API error, ambiguous failure)
- The failed message shows an inline error below it ("Couldn't process this — tap to retry")
- Retry re-sends the exact same message with one tap — the user does not retype
- If retry fails again, the user sees a plain-language explanation of what went wrong, not an error code
- Errors never delete or corrupt the message from history
- If the agent produces a response the user flags as wrong, a "This was wrong" action is available on the message and feeds back into the agent's learning pipeline

---

### 11. Voice Input

**Given** the user taps the mic icon
- Voice input activates without needing a second confirmation tap
- Live transcription appears in the input field as the user speaks
- The user can edit the transcription before sending
- If microphone permission is denied, the icon is hidden rather than shown disabled with no explanation
- Voice input works offline for transcription (on-device); it sends as a text message like any other

---

### 12. Conversation Search

**Given** the user needs to find a past instruction or decision
- A search entry point is accessible within 2 taps from the chat window
- Search queries against message content, client names, and dates
- Results show the matching message in context (not just the message in isolation)
- Tapping a result scrolls the thread to that message and highlights it
- Search works entirely on local data — no server required

---

### 13. Agent Interpretation Summary ("I heard...")

**Given** the agent processes any scheduling instruction
- The agent response includes a one-line confirmation of what it understood ("Got it — blocking Monday 3/31 as PTO")
- This summary is machine-readable enough for the user to spot mistakes at a glance
- If the agent's interpretation was wrong and the user corrects it, the original incorrect interpretation is not hidden in history (for auditability)

---

### 14. Onboarding / First-Run State

**Given** a new user opens the chat for the first time
- The chat window shows 3–5 example prompts the user can tap to get started, not a blank box
- The agent introduces its own capabilities in one message, not a tutorial modal series
- Example prompts are dismissed permanently once the user sends their first real message
- The agent asks for the user's working hours and service area in the first exchange — blocking all schedule building until it has the minimum viable context to be useful

---

### 15. Settings Access from Chat

**Given** the user wants to change agent behavior
- A settings shortcut is reachable from the chat in 1 tap (header icon or long-press on agent message)
- Settings include at minimum: notification preferences, default working hours, client communication preferences (agent sends messages vs. user approves first), learning data reset
- Changes to settings take effect on the next agent action, not retroactively
- "Learning data reset" requires a confirmation step and tells the user exactly what will be lost