# AI Assistant Guardrails for KE Agenda V3

> **CRITICAL**: These rules are NON-NEGOTIABLE. Any AI assistant working on this project MUST follow these guardrails exactly. Violation of these rules will result in project failure.

---

## 🚨 ABSOLUTE RULES - NEVER VIOLATE

### Rule #1: Tech Stack is LOCKED
```yaml
NEVER SUGGEST OR USE:
❌ Supabase client libraries (vendor lock-in)
❌ Clerk Auth (we use Better Auth)
❌ Apollo Client (use graphql-request)
❌ Firebase anything (wrong ecosystem)
❌ Prisma ORM (use Kysely)
❌ MongoDB/Mongoose (use PostgreSQL)
❌ Redux/MobX (use TanStack Query + Zustand)
❌ Axios (use native fetch)
❌ Moment.js (use date-fns)
❌ Lodash (use native methods)

ALWAYS USE EXACTLY:
✅ Better Auth (auth stored in YOUR database)
✅ PostgreSQL 16+ with Hasura GraphQL
✅ SQLite WASM with Kysely
✅ graphql-request (simple, no caching complexity)
✅ TanStack Query for server state
✅ Zustand for client state (if needed)
✅ date-fns v4.1.0 for dates
✅ Native fetch API
✅ Native array methods
```

### Rule #2: Local-First is MANDATORY
```typescript
// ❌ NEVER - Network-first operation
async function createAppointment(data) {
  const response = await fetch('/api/appointments', {...})
  if (response.ok) {
    updateLocalCache(data)
  }
}

// ✅ ALWAYS - Local-first operation
async function createAppointment(data) {
  // 1. Update local SQLite immediately
  await db.insertInto('appointments').values(data).execute()
  
  // 2. Update UI optimistically
  queryClient.setQueryData(['appointments'], old => [...old, data])
  
  // 3. Queue for background sync (non-blocking)
  syncQueue.add('appointments', 'CREATE', data)
  
  return data // Return immediately, don't wait for server
}
```

### Rule #3: Zero Blocking Operations
```typescript
// ❌ NEVER block on network
if (!navigator.onLine) {
  throw new Error('Internet required')
}

// ❌ NEVER show loading spinners for local operations
const [loading, setLoading] = useState(false)
setLoading(true)
await saveToServer(data)
setLoading(false)

// ✅ ALWAYS work offline
if (!navigator.onLine) {
  // Still works perfectly, just queues sync
  return localOperation(data)
}

// ✅ ALWAYS instant UI updates
await localOperation(data) // <100ms
syncInBackground(data) // Non-blocking
```

---

## 📝 CODE PATTERNS - MUST FOLLOW

### Pattern #1: Database Queries with Kysely
```typescript
// ❌ NEVER use raw SQL strings
const appointments = await db.execute('SELECT * FROM appointments WHERE user_id = ?', [userId])

// ❌ NEVER use Prisma
const appointments = await prisma.appointment.findMany({ where: { userId } })

// ✅ ALWAYS use Kysely for type safety
const appointments = await db
  .selectFrom('appointments')
  .selectAll()
  .where('user_id', '=', userId)
  .where('deleted_at', 'is', null)
  .orderBy('start_time', 'asc')
  .execute()
```

### Pattern #2: Authentication with Better Auth
```typescript
// ❌ NEVER use Supabase Auth
import { createClient } from '@supabase/supabase-js'
const { data: { user } } = await supabase.auth.getUser()

// ❌ NEVER use Clerk
import { useUser } from '@clerk/nextjs'
const { user } = useUser()

// ✅ ALWAYS use Better Auth
import { useSession } from '@/lib/auth'
const { data: session } = useSession()
const userId = session?.user.id
```

### Pattern #3: GraphQL with graphql-request
```typescript
// ❌ NEVER use Apollo Client
import { useQuery } from '@apollo/client'
const { data, loading } = useQuery(GET_APPOINTMENTS)

// ✅ ALWAYS use graphql-request with TanStack Query
import { request } from 'graphql-request'
import { useQuery } from '@tanstack/react-query'

const { data } = useQuery({
  queryKey: ['appointments'],
  queryFn: async () => {
    // Try local first
    const local = await db.selectFrom('appointments').selectAll().execute()
    
    // Background sync if online
    if (navigator.onLine) {
      request(HASURA_URL, GET_APPOINTMENTS).then(syncToLocal)
    }
    
    return local
  }
})
```

### Pattern #4: Form Handling with React Hook Form + Zod
```typescript
// ❌ NEVER use unvalidated forms
const handleSubmit = (e) => {
  e.preventDefault()
  const data = new FormData(e.target)
  saveAppointment(data) // No validation!
}

// ✅ ALWAYS validate with Zod
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const schema = z.object({
  client_id: z.string().uuid(),
  start_time: z.string().datetime(),
  service_id: z.string().uuid()
})

const { register, handleSubmit } = useForm({
  resolver: zodResolver(schema)
})
```

---

## 🏗️ ARCHITECTURE RULES

### Rule #1: Project Structure is FIXED
```
src/
├── app/                    # Next.js 15 App Router ONLY
├── components/            # React components
├── hooks/                 # Custom React hooks
├── lib/                   # Core libraries
│   ├── auth.ts           # Better Auth config
│   ├── database/         # SQLite + Kysely
│   ├── graphql/          # GraphQL queries
│   ├── weather/          # Weather service
│   └── routes/           # Route optimization
├── providers/            # React context providers
└── types/               # TypeScript types

❌ NEVER create:
- pages/ directory (use app/)
- api/ directory outside of app/
- server/ directory (use app/api/)
- stores/ directory (use providers/)
```

### Rule #2: State Management Hierarchy
```typescript
// 1. Local Database State (Source of Truth)
SQLite WASM (Kysely queries)
    ↓
// 2. TanStack Query (Cache Layer)
useQuery/useMutation hooks
    ↓
// 3. React State (UI State Only)
useState for forms, modals, etc.
    ↓
// 4. Zustand (Global UI State if needed)
For theme, sidebar state, etc.

❌ NEVER store business data in:
- React Context
- Redux/MobX
- localStorage (except for preferences)
- sessionStorage
```

### Rule #3: Error Handling Standards
```typescript
// ❌ NEVER let errors break the app
try {
  await riskyOperation()
} catch (error) {
  console.error(error)
  throw error // App crashes!
}

// ✅ ALWAYS graceful degradation
try {
  await syncWithServer()
} catch (error) {
  console.warn('Sync failed, queued for retry:', error)
  await queueForRetry(data)
  // App continues working with local data
  return localData
}
```

---

## 🚫 ANTI-PATTERNS TO DETECT & PREVENT

### Anti-Pattern #1: Network Dependencies
```typescript
// 🚨 STOP if you see:
- await fetch() without try/catch
- Loading spinners for local operations  
- "Please check your connection" errors
- Disabled buttons while saving
- if (!navigator.onLine) throw error

// ✅ REPLACE with:
- Local operation first, sync later
- Optimistic UI updates
- Graceful offline handling
- Always-enabled UI
- Queue failed syncs for retry
```

### Anti-Pattern #2: Vendor Lock-in
```typescript
// 🚨 STOP if you see:
- Supabase Realtime
- Supabase Storage
- Firebase Functions
- Vercel KV
- Planetscale specific features
- Clerk webhooks

// ✅ REPLACE with:
- Hasura subscriptions
- Cloudflare R2
- Standard PostgreSQL
- Redis (self-hosted)
- SQL standard features
- Better Auth callbacks
```

### Anti-Pattern #3: Over-Engineering
```typescript
// 🚨 STOP if you see:
- Abstract factory patterns
- 10+ levels of abstraction
- Dependency injection containers
- Complex state machines
- Operational transformation
- CRDT implementations

// ✅ REPLACE with:
- Simple direct implementations
- Maximum 3 levels of abstraction
- Direct imports
- Simple state (loading/error/data)
- Last-write-wins conflicts
- Version numbers for conflicts
```

---

## ✅ VALIDATION CHECKLIST

Before generating ANY code, verify:

### 1. Technology Check
- [ ] Uses Better Auth (not Supabase/Clerk)?
- [ ] Uses Kysely (not Prisma/raw SQL)?
- [ ] Uses graphql-request (not Apollo)?
- [ ] Uses PostgreSQL (not MongoDB)?
- [ ] Uses SQLite WASM (not IndexedDB alone)?

### 2. Pattern Check
- [ ] Local-first (not network-first)?
- [ ] Optimistic updates implemented?
- [ ] Works offline for 72+ hours?
- [ ] No loading spinners for local ops?
- [ ] Errors handled gracefully?

### 3. Performance Check
- [ ] Local operations <200ms?
- [ ] No blocking network calls?
- [ ] Bundle size considered?
- [ ] Lazy loading implemented?
- [ ] Images optimized?

### 4. Security Check
- [ ] Input validation with Zod?
- [ ] SQL injection prevented (Kysely)?
- [ ] XSS prevention in place?
- [ ] Secrets in environment variables?
- [ ] Row-level security in Hasura?

---

## 🎯 DECISION FLOWCHART

```
User asks for a feature
        ↓
Is it in tech_requirements_guide.md?
        ├─ Yes → Implement EXACTLY as specified
        └─ No ↓
           Does it require new dependencies?
                ├─ Yes → STOP! Ask for approval
                └─ No ↓
                   Does it work offline?
                        ├─ No → STOP! Redesign for local-first
                        └─ Yes ↓
                           Does it add vendor lock-in?
                                ├─ Yes → STOP! Find portable solution
                                └─ No → Safe to implement
```

---

## 🧪 TEST-DRIVEN DEVELOPMENT (MANDATORY)

### TDD Rule #1: Write Tests FIRST
```typescript
// ❌ NEVER write implementation before tests
function calculateRouteDistance(appointments) {
  // Complex implementation without tests
  return appointments.reduce((sum, apt) => sum + apt.distance, 0)
}

// ✅ ALWAYS write test first
describe('calculateRouteDistance', () => {
  test('should sum distances for multiple appointments', () => {
    const appointments = [
      { id: '1', distance: 10 },
      { id: '2', distance: 15 },
      { id: '3', distance: 5 }
    ]
    expect(calculateRouteDistance(appointments)).toBe(30)
  })
  
  test('should return 0 for empty array', () => {
    expect(calculateRouteDistance([])).toBe(0)
  })
  
  test('should handle null distances', () => {
    const appointments = [{ id: '1', distance: null }]
    expect(calculateRouteDistance(appointments)).toBe(0)
  })
})

// THEN write implementation to pass tests
function calculateRouteDistance(appointments: Appointment[]): number {
  return appointments.reduce((sum, apt) => sum + (apt.distance || 0), 0)
}
```

### TDD Rule #2: Red-Green-Refactor Cycle
```typescript
// Step 1: RED - Write failing test
test('appointment should sync to server', async () => {
  const appointment = { id: '1', client_id: 'c1' }
  const result = await syncAppointment(appointment)
  expect(result.synced).toBe(true)
})
// ❌ Test fails - function doesn't exist

// Step 2: GREEN - Minimal code to pass
async function syncAppointment(apt) {
  return { ...apt, synced: true }
}
// ✅ Test passes

// Step 3: REFACTOR - Improve while keeping tests green
async function syncAppointment(appointment: Appointment): Promise<SyncedAppointment> {
  validateAppointment(appointment)
  const synced = await syncToServer(appointment)
  return { ...appointment, synced: true, syncedAt: new Date() }
}
// ✅ Tests still pass
```

### TDD Rule #3: Test Coverage Requirements
```yaml
MINIMUM COVERAGE REQUIREMENTS:
- Statements: 80%
- Branches: 75%
- Functions: 80%
- Lines: 80%

CRITICAL PATH COVERAGE (100% Required):
- Authentication flows
- Payment processing
- Data synchronization
- Appointment CRUD operations
- Offline queue management
```

### TDD Rule #4: Test File Structure
```typescript
// For every implementation file, create a test file
src/
├── lib/
│   ├── auth.ts
│   ├── auth.test.ts              # Unit tests
│   ├── database/
│   │   ├── sqlite-manager.ts
│   │   ├── sqlite-manager.test.ts # Unit tests
│   │   └── sqlite-manager.integration.test.ts # Integration tests
├── hooks/
│   ├── use-appointments.ts
│   └── use-appointments.test.tsx  # Hook tests
└── components/
    ├── appointment-form.tsx
    └── appointment-form.test.tsx  # Component tests
```

---

## 🧹 CLEAN CODE PRINCIPLES (MANDATORY)

### Clean Code Rule #1: Single Responsibility
```typescript
// ❌ NEVER - Multiple responsibilities
class AppointmentService {
  createAppointment() { /* ... */ }
  sendEmail() { /* ... */ }
  calculateRoute() { /* ... */ }
  generateInvoice() { /* ... */ }
  updateWeather() { /* ... */ }
}

// ✅ ALWAYS - Single responsibility per class
class AppointmentService {
  createAppointment() { /* ... */ }
  updateAppointment() { /* ... */ }
  deleteAppointment() { /* ... */ }
}

class NotificationService {
  sendEmail() { /* ... */ }
  sendSMS() { /* ... */ }
}

class RouteService {
  calculateRoute() { /* ... */ }
  optimizeRoute() { /* ... */ }
}
```

### Clean Code Rule #2: Function Size & Complexity
```typescript
// ❌ NEVER - Long functions with multiple concerns
function processAppointment(data) {
  // Validate
  if (!data.client) throw new Error()
  if (!data.service) throw new Error()
  if (!data.date) throw new Error()
  
  // Calculate price
  let price = data.service.basePrice
  if (data.isWeekend) price *= 1.5
  if (data.isHoliday) price *= 2
  if (data.client.isVIP) price *= 0.9
  
  // Check weather
  const weather = await fetchWeather()
  if (weather.rain && data.service.outdoor) {
    // Reschedule logic...
  }
  
  // Save to database
  const appointment = await db.insert(...)
  
  // Send notifications
  await sendEmail(...)
  await sendSMS(...)
  
  return appointment
}

// ✅ ALWAYS - Small, focused functions
function validateAppointmentData(data: AppointmentInput): void {
  if (!data.client_id) throw new ValidationError('Client required')
  if (!data.service_id) throw new ValidationError('Service required')
  if (!data.start_time) throw new ValidationError('Date required')
}

function calculateAppointmentPrice(appointment: Appointment): number {
  const basePrice = appointment.service.price_cents
  const multipliers = [
    getWeekendMultiplier(appointment.start_time),
    getHolidayMultiplier(appointment.start_time),
    getVIPDiscount(appointment.client)
  ]
  return multipliers.reduce((price, mult) => price * mult, basePrice)
}

async function checkWeatherConflict(appointment: Appointment): Promise<boolean> {
  if (!appointment.service.weather_dependent) return false
  const weather = await weatherService.getForecast(appointment.location)
  return weather.is_outdoor_suitable === false
}

async function createAppointment(input: AppointmentInput): Promise<Appointment> {
  validateAppointmentData(input)
  
  const appointment = {
    ...input,
    price_cents: calculateAppointmentPrice(input),
    weather_alert: await checkWeatherConflict(input)
  }
  
  const saved = await appointmentRepository.create(appointment)
  await notificationQueue.add('appointment.created', saved)
  
  return saved
}
```

### Clean Code Rule #3: Meaningful Names
```typescript
// ❌ NEVER - Unclear names
const d = new Date()
const yrs = calcAge(d1, d2)
const apt = getApt(id)
const temp = data.map(x => x * 2)
function calc(a, b, c) { }

// ✅ ALWAYS - Descriptive names
const appointmentDate = new Date()
const ageInYears = calculateAgeInYears(birthDate, currentDate)
const appointment = getAppointmentById(appointmentId)
const doubledPrices = prices.map(price => price * 2)
function calculateDistanceBetweenAppointments(from: Location, to: Location, unit: DistanceUnit) { }
```

### Clean Code Rule #4: No Magic Numbers/Strings
```typescript
// ❌ NEVER - Magic values
if (appointment.duration > 180) { // What is 180?
  price *= 1.5 // What is 1.5?
}

if (status === 'CONF') { // What is CONF?
  sendNotification()
}

// ✅ ALWAYS - Named constants
const MAX_STANDARD_DURATION_MINUTES = 180
const EXTENDED_APPOINTMENT_MULTIPLIER = 1.5
const APPOINTMENT_STATUS = {
  SCHEDULED: 'scheduled',
  CONFIRMED: 'confirmed',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled'
} as const

if (appointment.duration > MAX_STANDARD_DURATION_MINUTES) {
  price *= EXTENDED_APPOINTMENT_MULTIPLIER
}

if (status === APPOINTMENT_STATUS.CONFIRMED) {
  sendNotification()
}
```

### Clean Code Rule #5: DRY (Don't Repeat Yourself)
```typescript
// ❌ NEVER - Duplicated logic
function validateClient(client) {
  if (!client.first_name || client.first_name.length < 2) {
    throw new Error('Invalid first name')
  }
  if (!client.last_name || client.last_name.length < 2) {
    throw new Error('Invalid last name')
  }
  if (!client.email || !client.email.includes('@')) {
    throw new Error('Invalid email')
  }
}

function validatePet(pet) {
  if (!pet.name || pet.name.length < 2) {
    throw new Error('Invalid pet name')
  }
  if (!pet.species || pet.species.length < 2) {
    throw new Error('Invalid species')
  }
}

// ✅ ALWAYS - Reusable validation
const createStringValidator = (field: string, minLength = 2) => {
  return (value: string) => {
    if (!value || value.length < minLength) {
      throw new ValidationError(`Invalid ${field}: minimum ${minLength} characters`)
    }
    return value
  }
}

const createEmailValidator = () => {
  return (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      throw new ValidationError('Invalid email format')
    }
    return email
  }
}

const validateClient = (client: ClientInput) => {
  createStringValidator('first name')(client.first_name)
  createStringValidator('last name')(client.last_name)
  createEmailValidator()(client.email)
  return client
}
```

### Clean Code Rule #6: Error Handling
```typescript
// ❌ NEVER - Generic error handling
try {
  doSomething()
} catch (e) {
  console.log('Error occurred')
}

// ❌ NEVER - Swallowing errors
try {
  await syncData()
} catch (e) {
  // Ignore
}

// ✅ ALWAYS - Specific error handling
class AppointmentNotFoundError extends Error {
  constructor(public appointmentId: string) {
    super(`Appointment ${appointmentId} not found`)
    this.name = 'AppointmentNotFoundError'
  }
}

class SyncFailedError extends Error {
  constructor(public operation: string, public data: any) {
    super(`Sync failed for ${operation}`)
    this.name = 'SyncFailedError'
  }
}

try {
  await syncAppointment(appointment)
} catch (error) {
  if (error instanceof NetworkError) {
    await queueForRetry(appointment)
    logger.warn('Network error, queued for retry', { appointment, error })
  } else if (error instanceof ValidationError) {
    logger.error('Invalid appointment data', { appointment, error })
    throw error // Re-throw for UI to handle
  } else {
    logger.error('Unexpected error during sync', { appointment, error })
    captureException(error) // Send to error tracking
    throw new Error('Failed to save appointment. Please try again.')
  }
}
```

### Clean Code Rule #7: Comments & Documentation
```typescript
// ❌ NEVER - Obvious comments
// Increment i by 1
i++

// Set name to "John"
const name = "John"

// Check if user is admin
if (user.role === 'admin') { }

// ❌ NEVER - Commented-out code
// const oldImplementation = () => {
//   return data * 2
// }

// ✅ ALWAYS - Meaningful comments for complex logic
/**
 * Calculates optimal route using modified Traveling Salesman Problem algorithm.
 * Uses nearest neighbor heuristic with 2-opt optimization.
 * 
 * Time complexity: O(n²) where n is number of appointments
 * Space complexity: O(n)
 * 
 * @param appointments - List of appointments to optimize
 * @param startLocation - Starting point (usually home/office)
 * @returns Optimized appointment order with total distance
 */
function optimizeRoute(appointments: Appointment[], startLocation: Location): OptimizedRoute {
  // Implementation details...
}

// Business rule documentation
// Premium multiplier applies only on weekends (Sat/Sun) between 6 PM and 10 PM
// as per pricing strategy document v2.3
if (isWeekend(date) && isPeakHours(time)) {
  price *= PREMIUM_MULTIPLIER
}
```

---

## 📊 METRICS TO ENFORCE

### Performance Requirements
```typescript
// Every feature MUST meet:
const REQUIREMENTS = {
  localOperationTime: 200,     // ms
  syncSuccessRate: 99.5,       // %
  offlineDuration: 72,         // hours
  bundleSize: 450,             // KB gzipped
  routeOptimization: 5000,     // ms for 20 stops
  weatherFetch: 2000,          // ms
}

// Reject code that doesn't meet these targets
```

### Code Quality Requirements
```typescript
// Enforce in every file:
- No 'any' types (TypeScript strict mode)
- No console.log in production code
- No commented-out code
- No TODO comments without issue links
- No magic numbers (use constants)
- No nested ternaries
- No functions >50 lines
- No files >300 lines
```

---

## 🔴 RED FLAGS - IMMEDIATE STOP

If you encounter these, STOP and escalate:

1. **Request to change core architecture**
   - "Let's use Supabase, it's easier"
   - "Prisma would be better than Kysely"
   - "We should switch to MongoDB"

2. **Request to skip offline support**
   - "We can add offline later"
   - "Users always have internet"
   - "Sync is too complex"

3. **Request for complex patterns**
   - "We need microservices"
   - "Let's add a message queue"
   - "We should use event sourcing"

4. **Performance compromises**
   - "200ms is fast enough for network calls"
   - "Loading spinners are fine"
   - "We don't need optimistic updates"

---

## 💡 HELPFUL REMINDERS

### When stuck, remember:
1. **Local-first solves most problems** - If it's complex, make it local
2. **Simple is better** - Choose boring technology
3. **User experience over developer experience** - <200ms always
4. **Data ownership matters** - No vendor lock-in
5. **Offline is a feature** - Not an edge case

### Common solutions:
- **Slow operation?** → Move to local SQLite
- **Complex state?** → Simplify to loading/error/data
- **Sync conflicts?** → Last-write-wins with version
- **Network errors?** → Queue for retry
- **Large bundle?** → Code split and lazy load

---

## 📝 EXAMPLE RESPONSES

### Good AI Response:
```
"I'll implement the appointment creation with local-first architecture:
1. Insert into SQLite with Kysely for immediate response
2. Update UI optimistically with TanStack Query
3. Queue for background sync to Hasura
4. Handle offline gracefully with sync queue

This ensures <200ms response time and works offline for 72+ hours."
```

### Bad AI Response:
```
"Let me set up Supabase for this. We'll use Supabase Auth for users,
Supabase Realtime for updates, and show a loading spinner while saving.
If the user is offline, we'll show an error message."
```

---

## 🧪 TEST REQUIREMENTS FOR EVERY FEATURE

### Test Types Required
```typescript
// For EVERY new feature, create:

// 1. Unit Tests (Required)
describe('AppointmentService', () => {
  describe('createAppointment', () => {
    test('should create appointment with valid data')
    test('should throw ValidationError with invalid data')
    test('should handle database errors gracefully')
    test('should queue for sync when offline')
  })
})

// 2. Integration Tests (Required for APIs)
describe('Appointment API Integration', () => {
  test('should sync appointment to Hasura')
  test('should handle network failures')
  test('should retry failed syncs')
})

// 3. Component Tests (Required for UI)
describe('AppointmentForm', () => {
  test('should render all required fields')
  test('should validate on submit')
  test('should show error messages')
  test('should be accessible (ARIA)')
})

// 4. E2E Tests (Required for critical paths)
describe('Appointment Booking Flow', () => {
  test('user can create appointment')
  test('appointment appears in calendar')
  test('appointment syncs to server')
  test('works offline and syncs later')
})
```

### Test Quality Gates
```yaml
BEFORE MERGING ANY PR:
✅ All tests pass
✅ Coverage meets minimums (80%)
✅ No skipped tests (.skip)
✅ No focused tests (.only)
✅ Tests run in <60 seconds
✅ Tests work in CI/CD
```

---

## 🧹 CLEAN CODE CHECKLIST

### Before Writing ANY Code
- [ ] Is there a test for this?
- [ ] Is the function <50 lines?
- [ ] Does it have a single responsibility?
- [ ] Are all names meaningful?
- [ ] Are there any magic numbers?
- [ ] Is error handling specific?
- [ ] Will it work offline?

### Code Review Checklist
```typescript
// AUTOMATICALLY REJECT if:
- Any function > 50 lines
- Any file > 300 lines
- Any class > 200 lines
- Cyclomatic complexity > 10
- Nesting depth > 3
- Parameters > 4
- No tests present
- Coverage < 80%
- Contains 'any' type
- Contains console.log
- Contains commented code
- Contains TODO without issue
```

---

## 🚀 FINAL ENFORCEMENT

**Every line of code must pass ALL these tests:**

```typescript
function isCodeAcceptable(code: string): boolean {
  return (
    // Architecture checks
    usesCorrectAuth(code, 'better-auth') &&
    usesCorrectDB(code, 'kysely') &&
    isLocalFirst(code) &&
    hasOptimisticUpdates(code) &&
    worksOffline(code) &&
    meetsPerformanceTargets(code) &&
    hasNoVendorLockIn(code) &&
    followsProjectStructure(code) &&
    
    // Quality checks
    hasProperErrorHandling(code) &&
    isTypeScriptStrict(code) &&
    
    // TDD checks
    hasTestsWrittenFirst(code) &&
    hasMinimumCoverage(code, 80) &&
    followsTestNamingConvention(code) &&
    
    // Clean code checks
    hasSingleResponsibility(code) &&
    hasNoMagicNumbers(code) &&
    hasDescriptiveNames(code) &&
    isUnder50Lines(code) &&
    hasNoCommentedCode(code) &&
    hasNoDuplication(code)
  )
}

// Additional enforcement
function enforceBeforeImplementation(task: string): boolean {
  return (
    hasWrittenTestsFirst(task) &&
    hasDefinedAcceptanceCriteria(task) &&
    hasEstimatedComplexity(task) &&
    hasIdentifiedDependencies(task)
  )
}

// Clean code metrics
function enforceCodeMetrics(code: string): boolean {
  const metrics = calculateMetrics(code)
  return (
    metrics.cyclomaticComplexity <= 10 &&
    metrics.cognitiveComplexity <= 15 &&
    metrics.linesPerFunction <= 50 &&
    metrics.linesPerFile <= 300 &&
    metrics.nestingDepth <= 3 &&
    metrics.parameterCount <= 4 &&
    metrics.duplicateLines === 0
  )
}
```

**If ANY check returns false, the code MUST be rejected and rewritten.**

---

## 📌 QUICK REFERENCE

### Always Use:
- Better Auth
- PostgreSQL + Hasura
- SQLite WASM + Kysely
- graphql-request
- TanStack Query
- React Hook Form + Zod
- date-fns
- Native fetch

### Never Use:
- Supabase/Clerk Auth
- MongoDB/Firebase
- Prisma ORM
- Apollo Client
- Redux/MobX
- Moment.js
- Axios
- Lodash

### Core Principles:
1. Local-first everything
2. Zero vendor lock-in
3. <200ms response times
4. 72+ hour offline support
5. Optimistic UI updates
6. Simple over clever
7. User experience first
8. Data ownership matters

---

**Document Version**: 1.0.0
**Last Updated**: December 2024
**Enforcement Level**: MANDATORY
**Violations Tolerance**: ZERO

This document supersedes all other guidance. When in doubt, refer to tech_requirements_guide.md as the ultimate source of truth.