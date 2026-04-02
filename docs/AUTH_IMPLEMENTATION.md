# Better Auth Implementation

## Overview
This document describes the Better Auth integration for KE Agenda V3, following the exact specifications in `tech_requirements_guide.md` (lines 385-446).

## Architecture

### Core Components

1. **Auth Configuration** (`src/lib/auth.ts`)
   - Better Auth instance with Drizzle adapter
   - SQLite database integration
   - Email/password authentication
   - Google and Apple OAuth
   - 7-day session management
   - Custom user fields (businessName, phone)

2. **API Routes** (`src/app/api/auth/[...auth]/route.ts`)
   - Catch-all route handler for all auth endpoints
   - Handles: sign-in, sign-up, sign-out, session, OAuth callbacks

3. **Auth Provider** (`src/providers/auth-provider.tsx`)
   - React context for authentication state
   - Client-side auth actions (signIn, signUp, signOut)
   - Integration with TanStack Query for session management

4. **Session Hook** (`src/hooks/use-session.ts`)
   - Custom React hook for accessing session
   - 5-minute cache with auto-refresh
   - Integrated with TanStack Query

5. **Middleware** (`src/middleware.ts`)
   - Route protection for authenticated routes
   - Session validation via cookies
   - Redirect logic for unauthorized access

6. **Types** (`src/types/auth.ts`)
   - TypeScript interfaces for User, Session, AuthSession
   - Type-safe credentials and error handling

## Configuration

### Environment Variables
Required in `.env.local`:
```bash
BETTER_AUTH_SECRET="your-secret-key"
BETTER_AUTH_URL="http://localhost:3025"
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
APPLE_CLIENT_ID="your-apple-client-id"
APPLE_CLIENT_SECRET="your-apple-client-secret"
```

### Session Settings
- **Session Duration**: 7 days
- **Session Update Age**: 24 hours
- **Cookie Cache**: 5 minutes
- **JWT Expiration**: 7 days

### Password Requirements
- **Minimum Length**: 8 characters
- **Maximum Length**: 128 characters
- **Email Verification**: Required

## Usage

### Setting Up the Provider

Wrap your app with AuthProvider in the root layout:

```typescript
// app/layout.tsx
import { AuthProvider } from '@/providers/auth-provider'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

export default function RootLayout({ children }) {
  const queryClient = new QueryClient()

  return (
    <html>
      <body>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            {children}
          </AuthProvider>
        </QueryClientProvider>
      </body>
    </html>
  )
}
```

### Using Authentication in Components

```typescript
// Sign In Component
import { useAuth } from '@/providers/auth-provider'

function SignInForm() {
  const { signIn, isLoading, error } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    await signIn({
      email: 'user@example.com',
      password: 'password123'
    })
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

```typescript
// Sign Up Component
import { useAuth } from '@/providers/auth-provider'

function SignUpForm() {
  const { signUp } = useAuth()

  const handleSubmit = async (e) => {
    e.preventDefault()
    await signUp({
      email: 'user@example.com',
      password: 'password123',
      name: 'John Doe',
      businessName: 'Acme Pet Grooming',
      phone: '+1234567890'
    })
  }

  return <form onSubmit={handleSubmit}>...</form>
}
```

```typescript
// Protected Component
import { useAuth } from '@/providers/auth-provider'

function Dashboard() {
  const { session, signOut, isLoading } = useAuth()

  if (isLoading) return <LoadingSpinner />
  if (!session) return <SignInPrompt />

  return (
    <div>
      <h1>Welcome {session.user.email}</h1>
      <button onClick={signOut}>Sign Out</button>
    </div>
  )
}
```

### Using the Session Hook

```typescript
import { useSession } from '@/hooks/use-session'

function UserProfile() {
  const { data: session, isLoading, error } = useSession()

  if (isLoading) return <div>Loading...</div>
  if (error) return <div>Error: {error.message}</div>
  if (!session) return <div>Not signed in</div>

  return (
    <div>
      <p>Email: {session.user.email}</p>
      <p>Business: {session.user.businessName}</p>
      <p>Phone: {session.user.phone}</p>
    </div>
  )
}
```

## Route Protection

### Protected Routes
These routes require authentication (defined in middleware.ts):
- `/dashboard`
- `/appointments`
- `/clients`
- `/routes`
- `/settings`

### Public Routes
These routes redirect to dashboard if authenticated:
- `/sign-in`
- `/sign-up`
- `/forgot-password`

### Middleware Flow
1. Check if route requires protection
2. Validate session token from cookie
3. Redirect to `/sign-in` if unauthorized
4. Redirect to `/dashboard` if authenticated user visits public route

## API Endpoints

All endpoints are handled by Better Auth through `/api/auth/[...auth]`:

- `POST /api/auth/sign-in` - Email/password sign in
- `POST /api/auth/sign-up` - Create new account
- `POST /api/auth/sign-out` - Sign out current session
- `GET /api/auth/session` - Get current session
- `GET /api/auth/callback/google` - Google OAuth callback
- `GET /api/auth/callback/apple` - Apple OAuth callback

## Database Schema

Better Auth automatically creates these tables in SQLite:
- `user` - User accounts
- `session` - Active sessions
- `account` - OAuth accounts
- `verification` - Email verification tokens

Custom fields added to `user` table:
- `businessName` (string, optional)
- `phone` (string, optional)

## Testing

Run tests with:
```bash
npm test src/lib/auth.test.ts
```

Tests cover:
- Auth configuration
- Type definitions
- Session expiration settings
- Cookie cache settings

## Security Features

1. **Email Verification**: Required for email/password signups
2. **Secure Cookies**: HTTP-only, secure cookies for session tokens
3. **JWT Tokens**: Signed with secret key
4. **Password Hashing**: Automatic password hashing
5. **CSRF Protection**: Built into Better Auth
6. **Session Expiration**: Automatic cleanup of expired sessions

## Integration with Other Systems

### Database Sync
After successful sign-in, the `createUserProfile` callback creates:
- User profile in business tables
- Initial sync setup
- Default settings

### Offline Support
- Session tokens cached locally
- Auth state persists during offline periods
- Automatic session refresh when online

## Troubleshooting

### Common Issues

1. **"BETTER_AUTH_SECRET not found"**
   - Ensure `.env.local` has all required variables
   - Restart dev server after adding env vars

2. **"Session not found"**
   - Clear browser cookies
   - Check cookie settings in browser
   - Verify session hasn't expired

3. **OAuth redirect not working**
   - Verify OAuth credentials in `.env.local`
   - Check callback URLs in OAuth provider settings
   - Ensure BETTER_AUTH_URL matches your domain

## Future Enhancements

- [ ] Add phone number authentication
- [ ] Implement password reset flow
- [ ] Add two-factor authentication
- [ ] Add session management dashboard
- [ ] Implement rate limiting
- [ ] Add audit logging

## References

- Better Auth Documentation: https://better-auth.com
- Tech Requirements Guide: `/docs/tech_requirements_guide.md` (lines 385-446)
- AI Guardrails: `/docs/AI_GUARDRAILS.md` (lines 106-120)
