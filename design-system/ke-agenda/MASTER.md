# KE Agenda — Design System

> **Date:** 2026-03-28
> **Philosophy:** Dark-first, chat-forward, built for professionals who live in this app all day — in cars, on porches, in barns, under fluorescent lights.
> **LOGIC:** When building a specific page, first check `design-system/ke-agenda/pages/[page-name].md`. If that file exists, its rules **override** this Master file. If not, strictly follow the rules below.

---

## Design Principles

1. **The chat IS the app.** Everything supports the conversation. The message thread is the hero.
2. **Easy on the eyes.** Low-contrast backgrounds, high-contrast text. No eye strain at hour 6.
3. **Works in sunlight.** Dark mode is actually better outdoors (less glare). Light mode must also work — no washed-out grays.
4. **Professional but human.** These are people-people (groomers, trainers, teachers, caregivers). Not cold, not cutesy. Warm and capable.
5. **Content over chrome.** Minimal UI decoration. The user's data (clients, appointments, messages) is the visual interest.

---

## Color System

### Dark Mode (Primary)

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-base` | `#0C0F14` | App background — near-black with slight blue warmth |
| `--bg-surface` | `#161B22` | Cards, sidebar, panels |
| `--bg-elevated` | `#1C2333` | Modals, popovers, active states |
| `--bg-input` | `#0D1117` | Input fields, composer |
| `--border-default` | `#30363D` | Subtle borders, dividers |
| `--border-emphasis` | `#484F58` | Focused inputs, hover borders |
| `--text-primary` | `#E6EDF3` | Main body text — warm white, not pure |
| `--text-secondary` | `#8B949E` | Labels, timestamps, helper text |
| `--text-muted` | `#484F58` | Placeholders, disabled |
| `--accent` | `#58A6FF` | Links, active tabs, primary actions — sky blue |
| `--accent-emphasis` | `#1F6FEB` | Buttons, badges — deeper blue for interaction |
| `--accent-subtle` | `#121D2F` | Accent backgrounds (selected states, hover) |
| `--success` | `#3FB950` | Synced, confirmed, completed |
| `--warning` | `#D29922` | Stale data, weather alerts, budget warnings |
| `--danger` | `#F85149` | Errors, conflicts, cancel actions |
| `--info` | `#58A6FF` | System messages, tips |

### Light Mode

| Token | Hex | Usage |
|-------|-----|-------|
| `--bg-base` | `#FFFFFF` | App background — true white |
| `--bg-surface` | `#F6F8FA` | Cards, sidebar, panels |
| `--bg-elevated` | `#FFFFFF` | Modals, popovers (white + shadow) |
| `--bg-input` | `#F6F8FA` | Input fields, composer |
| `--border-default` | `#D0D7DE` | Subtle borders |
| `--border-emphasis` | `#8C959F` | Focus states |
| `--text-primary` | `#1F2328` | Main text — not pure black, slightly warm |
| `--text-secondary` | `#656D76` | Labels, timestamps |
| `--text-muted` | `#8C959F` | Placeholders |
| `--accent` | `#0969DA` | Links, active tabs — strong blue |
| `--accent-emphasis` | `#0550AE` | Buttons, badges |
| `--accent-subtle` | `#DDF4FF` | Selected states, hover backgrounds |
| `--success` | `#1A7F37` | Synced, confirmed |
| `--warning` | `#9A6700` | Alerts, warnings |
| `--danger` | `#CF222E` | Errors, conflicts |
| `--info` | `#0969DA` | System messages |

### Chat Bubble Colors

| Token | Dark | Light | Usage |
|-------|------|-------|-------|
| `--bubble-user` | `#1F6FEB` | `#0969DA` | User message background |
| `--bubble-user-text` | `#FFFFFF` | `#FFFFFF` | User message text |
| `--bubble-agent` | `#1C2333` | `#F6F8FA` | Agent message background |
| `--bubble-agent-text` | `#E6EDF3` | `#1F2328` | Agent message text |
| `--bubble-system` | `#121D2F` | `#DDF4FF` | System/alert messages |
| `--bubble-system-text` | `#58A6FF` | `#0550AE` | System message text |

---

## Typography

**Font:** `Inter` — the workhorse. Designed for screens, excellent at small sizes, variable weight, free.

**Fallback:** `system-ui, -apple-system, sans-serif`

**Why Inter:** Reads well at 14px on mobile. Distinctive enough to feel designed, neutral enough to not impose a personality. Has tabular numbers for scheduling data.

| Element | Size | Weight | Line Height | Tracking |
|---------|------|--------|-------------|----------|
| Chat message | 15px / 0.9375rem | 400 | 1.5 | 0 |
| Chat timestamp | 12px / 0.75rem | 400 | 1.33 | 0.01em |
| Card title | 14px / 0.875rem | 600 | 1.4 | -0.01em |
| Card body | 13px / 0.8125rem | 400 | 1.5 | 0 |
| Section heading | 13px / 0.8125rem | 600 | 1.33 | 0.04em (uppercase) |
| Page title | 20px / 1.25rem | 600 | 1.3 | -0.02em |
| Button | 14px / 0.875rem | 500 | 1 | 0.01em |
| Input | 15px / 0.9375rem | 400 | 1.5 | 0 |
| Badge/chip | 12px / 0.75rem | 500 | 1 | 0.02em |

---

## Spacing & Layout

**Base unit:** 4px (consistent with Tailwind)

| Token | Value | Usage |
|-------|-------|-------|
| `--space-xs` | 4px | Inline gaps, badge padding |
| `--space-sm` | 8px | Between related items |
| `--space-md` | 12px | Card padding, list item gaps |
| `--space-lg` | 16px | Section padding, message gaps |
| `--space-xl` | 24px | Page padding, section separators |
| `--space-2xl` | 32px | Major section breaks |

**Chat-specific spacing:**
- Message bubble padding: 12px 16px
- Between messages from same sender: 4px
- Between messages from different senders: 16px
- Composer area: 12px padding, 48px min height
- Sidebar width: 280px (desktop), full-screen sheet (mobile)

**Breakpoints:**
- Mobile: < 640px (primary target — phone)
- Tablet: 640px - 1024px (primary target — iPad)
- Desktop: > 1024px (secondary — for office use)

---

## Components

### Chat Bubbles
- User: right-aligned, accent background, white text, rounded-2xl with rounded-br-md
- Agent: left-aligned, surface background, primary text, rounded-2xl with rounded-bl-md
- System: full-width, subtle accent background, centered text, rounded-xl
- Max width: 85% on mobile, 65% on desktop

### Cards (Schedule Preview, Client Info)
- Background: `--bg-surface`
- Border: 1px `--border-default`
- Border-radius: 12px
- Padding: 16px
- Hover: border transitions to `--border-emphasis`, subtle shadow
- Active/selected: left border 3px `--accent`

### Suggestion Chips
- Background: `--bg-elevated`
- Border: 1px `--border-default`
- Border-radius: 9999px (pill)
- Padding: 6px 14px
- Font: 13px/500
- Hover: background transitions to `--accent-subtle`, border to `--accent`

### Buttons
- Primary: `--accent-emphasis` bg, white text, rounded-lg, 44px min height (touch target)
- Secondary: transparent bg, `--accent` text, 1px `--border-default` border, rounded-lg
- Danger: `--danger` bg (muted in dark), white text
- All buttons: 44px minimum touch target, 150ms transition

### Input / Composer
- Background: `--bg-input`
- Border: 1px `--border-default`
- Focus: border `--accent`, ring 2px `--accent-subtle`
- Border-radius: 12px (composer), 8px (form inputs)
- Placeholder: `--text-muted`
- Min height: 44px

### Badges & Status
- Synced: `--success` bg (muted), success text
- Offline: `--warning` bg (muted), warning text
- Error: `--danger` bg (muted), danger text
- Pending: `--text-secondary`, clock icon

---

## Icons

**Library:** Lucide React (already in project via shadcn/ui)

**Size rules:**
- Inline (with text): 16px
- Action buttons: 20px
- Empty states: 48px
- Navigation: 20px

**Stroke width:** 1.75px (slightly lighter than default 2px — feels more refined)

---

## Motion

- **Micro-interactions:** 150ms ease-out (hover, focus, toggle)
- **Content transitions:** 200ms ease-out (panel open, tab switch)
- **Page transitions:** 300ms ease-in-out (route change)
- **Thinking indicator:** Pulsing dots, 1.2s ease-in-out infinite
- **Respect `prefers-reduced-motion`:** Disable all non-essential animations

---

## Shadows (Light Mode Only)

Dark mode uses borders, not shadows.

| Token | Value | Usage |
|-------|-------|-------|
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.06)` | Cards, dropdowns |
| `--shadow-md` | `0 4px 12px rgba(0,0,0,0.08)` | Modals, elevated panels |
| `--shadow-lg` | `0 8px 24px rgba(0,0,0,0.12)` | Popovers, floating elements |

---

## Accessibility

- Minimum 4.5:1 contrast ratio for all text (WCAG AA)
- 44px minimum touch targets on all interactive elements
- Visible focus rings (`--accent` ring, 2px offset)
- `aria-label` on all icon-only buttons
- `prefers-reduced-motion` honored
- `prefers-color-scheme` for auto dark/light detection
- Keyboard navigation: tab order matches visual order

---

## Anti-Patterns (Never Do)

- No emojis as UI icons — use Lucide SVGs
- No pure white (#FFFFFF) text on dark backgrounds — use `--text-primary` (warm white)
- No pure black (#000000) backgrounds — use `--bg-base` (warm dark)
- No gradients on interactive elements (buttons, chips) — save for marketing pages
- No skeleton loaders for instant local operations — only for network-dependent content
- No industry-specific imagery (paws, musical notes, stethoscopes) — keep it universal
- No loading spinners for <200ms operations
- No toast notifications for expected actions (save, send) — only for unexpected events (sync error, conflict)
