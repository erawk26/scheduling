# KE Agenda V3 - AI Assistant Context

> **CRITICAL**: This file provides essential context for AI assistants. Read this FIRST before any work.

## 🎯 Project Overview

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

## 🚨 MANDATORY READING ORDER

Before touching ANY code, read these documents in order:

1. **[AI_GUARDRAILS.md](./docs/AI_GUARDRAILS.md)** - ⚠️ CRITICAL rules you MUST follow
2. **[tech_requirements_guide.md](./docs/tech_requirements_guide.md)** - The ONLY source of truth
3. **[HIVE_PROJECT_PLAN.md](./docs/HIVE_PROJECT_PLAN.md)** - Development roadmap

---

## 🏗️ Current Project State

### Completed ✅
- Technical requirements defined
- Architecture decisions locked
- Database schema designed
- Project plan created

### In Progress 🔄
- Project initialization
- SQLite WASM setup
- Better Auth integration
- Base UI components

### Not Started ❌
- Calendar interface
- Weather integration
- Route optimization
- PWA setup

---

## ⚠️ CRITICAL RULES - NEVER VIOLATE

### Tech Stack (LOCKED)
```yaml
✅ MUST USE:
- Better Auth (NOT Supabase/Clerk)
- PostgreSQL + Hasura (NOT Supabase)
- SQLite WASM + Kysely (NOT Prisma)
- graphql-request (NOT Apollo)
- TanStack Query (NOT SWR)
- React Hook Form + Zod
- date-fns (NOT moment)

❌ NEVER USE:
- Supabase anything
- Clerk Auth
- Firebase
- Prisma ORM
- Apollo Client
- Redux/MobX
- Moment.js
- Lodash
```

### Architecture Rules
1. **EVERY operation is local-first** - SQLite before network
2. **NEVER block on network** - Queue and retry
3. **ALWAYS write tests first** - TDD is mandatory
4. **Functions < 50 lines** - Clean code enforced
5. **80% test coverage minimum** - 100% for critical paths

---

## 📁 Project Structure

```
minimal-app/
├── src/
│   ├── app/                 # Next.js 15 App Router
│   ├── components/          # React components
│   ├── hooks/              # Custom hooks
│   ├── lib/                # Core libraries
│   │   ├── auth.ts         # Better Auth config
│   │   ├── database/       # SQLite + Kysely
│   │   ├── graphql/        # Hasura queries
│   │   ├── weather/        # Tomorrow.io
│   │   └── routes/         # Google Maps
│   ├── providers/          # React contexts
│   └── types/              # TypeScript types
├── docs/
│   ├── AI_GUARDRAILS.md    # Rules for AI
│   ├── tech_requirements_guide.md  # Tech spec
│   └── HIVE_PROJECT_PLAN.md  # Roadmap
└── tests/                   # Test files
```

---

## 🎯 Current Sprint Focus

### Week 1-3: Foundation
- [ ] Initialize Next.js 15.4.5 project
- [ ] Setup PostgreSQL + Hasura
- [ ] Integrate Better Auth
- [ ] Configure SQLite WASM
- [ ] Implement Kysely for both DBs
- [ ] Create sync engine
- [ ] Build base UI components

### Success Criteria
- [ ] Local CRUD operations work
- [ ] Auth flow complete
- [ ] Basic sync functioning
- [ ] Tests passing with 80% coverage

---

## 💻 Development Workflow

### Before Writing Code
1. **Read the guardrails** - AI_GUARDRAILS.md
2. **Write tests first** - TDD is mandatory
3. **Check tech requirements** - No substitutions
4. **Verify offline-first** - Must work without internet

### Code Standards
```typescript
// EVERY function must:
✅ Be < 50 lines
✅ Have a single responsibility
✅ Have descriptive names
✅ Handle errors gracefully
✅ Work offline
✅ Have tests

// NEVER:
❌ Use 'any' type
❌ Have magic numbers
❌ Leave console.log
❌ Comment out code
❌ Skip error handling
❌ Block on network
```

### Git Workflow
```bash
# Branch naming
feature/calendar-ui
fix/sync-queue-retry
test/appointment-validation

# Commit messages
feat: Add appointment creation with offline support
fix: Handle sync conflicts with last-write-wins
test: Add coverage for weather service
docs: Update API documentation
```

---

## 🔍 Quick Decision Guide

### When you need to make a technical decision:

```
Is it in tech_requirements_guide.md?
  YES → Use exactly as specified
  NO ↓
    
Does it require a new dependency?
  YES → STOP! Get approval first
  NO ↓
    
Will it work offline for 72+ hours?
  NO → STOP! Redesign for local-first
  YES ↓
    
Does it add vendor lock-in?
  YES → STOP! Find portable solution
  NO ↓
    
Are there tests written first?
  NO → STOP! Write tests first
  YES ↓
    
Proceed with implementation
```

---

## 📊 Performance Targets

Every feature MUST meet these requirements:

| Metric | Target | Current |
|--------|--------|---------|
| Local operations | <200ms | Not measured |
| Sync success rate | >99.5% | Not implemented |
| Offline duration | 72+ hours | Not tested |
| Bundle size | <450KB | Not built |
| Route optimization | <5s for 20 stops | Not implemented |
| Test coverage | >80% | 0% |

---

## 🐛 Common Issues & Solutions

### Problem: "Should I use Supabase?"
**Answer**: NO! Use Better Auth + PostgreSQL + Hasura

### Problem: "Prisma would be easier"
**Answer**: NO! Use Kysely for type-safe queries

### Problem: "Loading spinner while saving"
**Answer**: NO! Local save + optimistic update + background sync

### Problem: "This works online only"
**Answer**: Redesign for local-first with SQLite WASM

### Problem: "Function is 100+ lines"
**Answer**: Break into smaller functions, max 50 lines

### Problem: "No tests yet, will add later"
**Answer**: Write tests FIRST, then implementation

---

## 🚀 Getting Started

### First Time Setup
```bash
# Clone repository
git clone [repository-url]
cd minimal-app

# Install dependencies
npm install

# Setup environment
cp .env.example .env.local
# Edit .env.local with your keys

# Start development
npm run dev

# Run tests
npm test

# Check coverage
npm run test:coverage
```

### Daily Workflow
```bash
# Start your day
git pull origin main
npm install  # In case deps changed
npm test     # Ensure tests pass

# Create feature branch
git checkout -b feature/your-feature

# Write tests first!
npm run test:watch

# Implement feature
# ... code ...

# Verify everything
npm test
npm run lint
npm run type-check

# Commit with conventional commits
git add .
git commit -m "feat: your feature description"
git push origin feature/your-feature
```

---

## 📚 Key Documentation Links

### Internal Docs
- [AI Guardrails](./docs/AI_GUARDRAILS.md) - MUST READ
- [Tech Requirements](./docs/tech_requirements_guide.md) - Source of truth
- [Project Plan](./docs/HIVE_PROJECT_PLAN.md) - Development roadmap
- [User Stories](./docs/user_stories_acceptance_criteria.md) - Feature specs

### External Docs
- [Better Auth](https://better-auth.com) - Authentication
- [Kysely](https://kysely.dev) - Database queries
- [Hasura](https://hasura.io/docs) - GraphQL engine
- [SQLite WASM](https://sqlite.org/wasm) - Local database
- [TanStack Query](https://tanstack.com/query) - Data fetching

---

## ⚠️ RED FLAGS - Stop Immediately If:

1. Someone suggests Supabase/Firebase/Clerk
2. Someone wants to skip offline support
3. Someone says "we'll add tests later"
4. Someone wants to change core architecture
5. Someone creates 100+ line functions
6. Someone adds vendor lock-in

**If any red flag appears → Check AI_GUARDRAILS.md → Check tech_requirements_guide.md → Escalate if needed**

---

## 🎨 Visual Development

### Design System Documentation
- **Main design documentation**: `/docs/design/README.md`
- **Design system specifications**: `/docs/design/design-system.md`
- **Component library**: `/docs/design/component-library.md`
- **UI/UX patterns**: `/docs/design/ui-patterns.md`
- When making visual (front-end, UI/UX) changes, always refer to the design system documentation for guidance

### Quick Visual Check
IMMEDIATELY after implementing any front-end change:
1. **Identify what changed** - Review the modified components/pages
2. **Navigate to affected pages** - Use `mcp__playwright__browser_navigate` to visit each changed view
3. **Verify design compliance** - Compare against `/docs/design/` documentation
4. **Validate feature implementation** - Ensure the change fulfills the user's specific request
5. **Check acceptance criteria** - Review any provided context files or requirements
6. **Capture evidence** - Take full page screenshot at desktop viewport (1440px) of each changed view
7. **Check for errors** - Run `mcp__playwright__browser_console_messages`

This verification ensures changes meet design standards and user requirements.

### Design Implementation Checklist
Before implementing UI changes:
- [ ] Review `/docs/design/design-system.md` for color, spacing, and typography tokens
- [ ] Check `/docs/design/component-library.md` for existing component patterns
- [ ] Verify mobile responsiveness requirements in `/docs/design/ui-patterns.md`
- [ ] Use shadcn/ui components from `@/components/ui/`
- [ ] Apply Tailwind CSS v4 utility classes consistently
- [ ] Ensure minimum 44px touch targets for mobile
- [ ] Implement loading states with skeletons (never spinners for local ops)
- [ ] Add proper ARIA labels for accessibility

---

## 📝 Notes for AI Assistants

### Your Priorities
1. **Follow guardrails** - AI_GUARDRAILS.md is law
2. **Test first** - TDD is mandatory
3. **Local first** - Everything works offline
4. **Clean code** - Small functions, clear names
5. **No vendor lock-in** - Portable solutions only
6. **Design consistency** - Follow design system strictly

### When Stuck
- Check tech_requirements_guide.md
- Review AI_GUARDRAILS.md
- Consult design documentation in `/docs/design/`
- Look at existing patterns in codebase
- Ask for clarification rather than guess
- Default to simpler solution

### Remember
- This is a LOCAL-FIRST app (not offline-first)
- Performance matters (<200ms always)
- User experience > Developer experience
- Simple > Clever
- Boring technology > Cutting edge
- Design consistency > Individual creativity

---

**Project Version**: 3.0.0
**Last Updated**: December 2024
**Status**: Foundation Phase (Week 1-3)

**⚠️ When in doubt, consult tech_requirements_guide.md - it is the ONLY source of truth**