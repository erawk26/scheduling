# Chat Page — Design Overrides

> Overrides `MASTER.md` for `/dashboard/chat`
> The chat is the primary interface. Every pixel serves the conversation.

---

## Layout

```
┌─────────────────────────────────────┐
│ Header: thread title + sync status  │  48px fixed
├──────────┬──────────────────────────┤
│ Sidebar  │  Message Thread          │
│ (threads)│                          │
│          │  [agent bubble]          │
│ 280px    │       [user bubble]      │
│ desktop  │  [agent bubble]          │
│          │    [suggestion chips]    │
│ sheet    │                          │
│ mobile   │                          │
│          ├──────────────────────────┤
│          │  Composer Input          │  min 48px, max 4 lines
│          │  [mic] [input...] [send] │
└──────────┴──────────────────────────┘
```

**Mobile (< 640px):** Sidebar hidden, accessible via hamburger. Thread fills viewport. Composer sticks to bottom with safe area inset.

**Tablet (640-1024px):** Sidebar as collapsible panel (280px). Thread fills remaining width.

**Desktop (> 1024px):** Sidebar always visible. Thread max-width 720px centered in remaining space.

---

## Header

- Height: 48px
- Content: Thread title (truncated, left), sync status icon (right), settings gear (right)
- Background: `--bg-surface`
- Bottom border: 1px `--border-default`
- Thread title: `--text-primary`, 14px/600, truncate with ellipsis at 200px
- No shadow — border only

---

## Message Thread

- Background: `--bg-base` (the darkest/lightest surface — messages float on it)
- Scroll: vertical, momentum scroll on iOS (`-webkit-overflow-scrolling: touch`)
- Auto-scroll to bottom on new messages
- Scroll-up detection for "New message" badge

### User Messages
- Align: right
- Background: `--bubble-user`
- Text: `--bubble-user-text`, 15px/400
- Border-radius: 20px 20px 6px 20px (flat bottom-right, like iMessage)
- Max-width: 85% mobile, 65% desktop
- Timestamp: below bubble, right-aligned, `--text-muted`, 12px

### Agent Messages
- Align: left
- Background: `--bubble-agent`
- Text: `--bubble-agent-text`, 15px/400
- Border-radius: 20px 20px 20px 6px (flat bottom-left)
- Max-width: 85% mobile, 65% desktop
- Timestamp: below bubble, left-aligned, `--text-muted`, 12px
- Markdown rendering: links in `--accent`, code blocks in `--bg-input` with `--border-default` border

### System Messages
- Align: center
- Background: `--bubble-system`
- Text: `--bubble-system-text`, 13px/500
- Border-radius: 12px
- Max-width: 90%
- Icon: left-aligned inline (Lucide `info`, `alert-triangle`, or `check-circle`), 16px
- Label: "Update" or "Alert" in `--text-secondary`, 11px uppercase

### Message Grouping
- Same sender, < 2 minutes apart: 4px gap, no repeated avatar/name
- Different sender or > 2 minutes: 16px gap, show timestamp
- Day boundary: centered date separator ("Today", "Yesterday", "Mon, Mar 24"), `--text-muted`, 12px, horizontal rules

---

## Thinking Indicator

- Position: left-aligned like an agent message
- Background: `--bubble-agent`
- Content: 3 animated dots (6px circles), `--text-secondary`
- Animation: sequential bounce, 1.2s loop, ease-in-out
- After 3s: replace dots with status text ("Checking your schedule...", `--text-secondary`, 13px)
- After 15s: add "This is taking longer than usual" below, `--warning`, 12px

---

## Suggestion Chips

- Position: below the last agent message, left-aligned
- Layout: horizontal scroll on mobile (no wrap), flex-wrap on desktop
- Gap: 8px
- Chip: pill shape, `--bg-elevated`, 1px `--border-default`, 13px/500
- Hover: `--accent-subtle` bg, `--accent` border
- Tap: sends as visible user message (autoSend)
- Disappear: on next user message send

---

## Schedule Preview Cards (in-chat)

- Position: inline in agent message, full bubble width
- Background: `--bg-surface` (slightly elevated from bubble)
- Border: 1px `--border-default`, 12px radius
- Content layout:
  ```
  ┌──────────────────────────────┐
  │ 🕐 10:00 AM  ·  45 min      │  time + duration row
  │ Sarah Johnson                │  client name, 14px/600
  │ Bath & Blowout               │  service, 13px/400, --text-secondary
  │ 123 Oak Street, Portland     │  address, 13px/400, --text-secondary
  ├──────────────────────────────┤
  │ [Confirm]         [Edit]     │  action row, right-aligned
  └──────────────────────────────┘
  ```
- Conflict flag: left border 3px `--warning`, amber badge "Conflict" top-right
- Multi-day: day separator between groups ("Monday, March 31")
- Confirm button: `--accent-emphasis`, compact (36px height, 13px text)
- Edit button: secondary style, same size

---

## Disambiguation Options (in-chat)

- Position: inline in agent message, rendered by `makeAssistantToolUI`
- Layout: vertical stack of tappable option cards
- Option card: `--bg-elevated`, 1px `--border-default`, 12px radius, 44px min height
- Content: option label (14px/500), optional subtitle (12px/400, `--text-secondary`)
- Hover: `--accent-subtle` bg, `--accent` border
- Tap: sends option as visible user message

---

## Composer

- Position: fixed to bottom, above safe area inset on iOS
- Background: `--bg-surface`
- Top border: 1px `--border-default`
- Padding: 12px
- Layout: `[mic-btn] [textarea] [send-btn]`

### Textarea
- Background: `--bg-input`
- Border: 1px `--border-default`, 12px radius
- Focus: `--accent` border, 2px ring `--accent-subtle`
- Placeholder: "Message your assistant...", `--text-muted`
- Min height: 44px (single line)
- Max height: 4 lines, then internal scroll
- Font: 15px/400 (matches message text)

### Send Button
- Size: 36px circle
- Background: `--accent-emphasis` when input has content, `--bg-elevated` when empty
- Icon: Lucide `send`, 18px, white when active, `--text-muted` when disabled
- Disabled when: empty/whitespace input, or response pending

### Mic Button (Phase 5)
- Size: 36px circle
- Background: transparent
- Icon: Lucide `mic`, 18px, `--text-secondary`
- Hidden if browser doesn't support speech recognition

### Character Counter
- Position: inside textarea, bottom-right
- Visible: only at 900+ characters
- Color: `--text-secondary` at 900-999, `--danger` at 1000+
- Font: 11px/500

---

## Offline Banner

- Position: below header, full width
- Background: `--warning` at 10% opacity
- Text: "Offline — changes will sync when connected", `--warning`, 13px/500
- Icon: Lucide `wifi-off`, 16px, left of text
- Height: 32px
- Dismiss: not dismissable (shows as long as offline)
- Animation: slide-down 200ms on disconnect, slide-up on reconnect

---

## Sync Status Icon (header)

- Position: header right, before settings gear
- States:
  - Synced: Lucide `check-circle`, `--success`, 16px. Tooltip: "Synced 2 min ago"
  - Syncing: Lucide `refresh-cw`, `--accent`, 16px, spinning 1s linear infinite
  - Offline: Lucide `wifi-off`, `--warning`, 16px
  - Error: Lucide `alert-circle`, `--danger`, 16px. Tap shows error + retry

---

## Empty State (new thread)

- Center of thread area, vertically centered
- Icon: Lucide `message-square-plus`, 48px, `--text-muted`
- Heading: "How can I help?", 18px/600, `--text-primary`
- Subheading: none (the example prompts speak for themselves)
- Example prompts: 3-5 `ThreadPrimitive.Suggestion` chips, centered, wrapped
  - "What does my week look like?"
  - "Help me plan next week"
  - "Add a new client"
  - "Check the weather for tomorrow"
- Chips use same style as suggestion chips above
- Dismissed permanently after first message sent

---

## Error State (failed message)

- Failed user message: normal bubble + red underline
- Below bubble: "Couldn't send — tap to retry", `--danger`, 13px
- Retry: tap the error text resends the exact message
- Second failure: "Something went wrong. Check your connection and try again.", `--danger`, 13px
- Never delete the failed message from history

---

## Thread Sidebar

### Desktop (> 1024px)
- Width: 280px, fixed left
- Background: `--bg-surface`
- Right border: 1px `--border-default`

### Mobile (< 1024px)
- Full-screen sheet, slides from left
- Trigger: hamburger icon in header left

### Thread List
- Each thread: 56px height, 12px horizontal padding
- Title: 14px/500, `--text-primary`, truncate with ellipsis
- Subtitle: last message preview, 12px/400, `--text-secondary`, 1 line truncated
- Timestamp: right-aligned, 11px, `--text-muted`
- Active thread: `--accent-subtle` background, left border 3px `--accent`
- Hover: `--bg-elevated` background

### New Thread Button
- Top of sidebar, full width minus padding
- Style: secondary button, Lucide `plus` icon + "New chat"
- 44px height
