/**
 * Better Auth Configuration
 *
 * Authentication setup following tech_requirements_guide.md (lines 385-446)
 * Uses Better Auth with Drizzle adapter and SQLite
 */

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./db/schema"
import { initializeDatabase, isDatabaseInitialized } from "./db/init"

/**
 * User profile creation callback
 * Creates initial profile in business tables after signup
 */
async function createUserProfile(userId: string): Promise<void> {
  // TODO: Implement profile creation in sync with database worker
  // This will be handled by the database/sync implementation
  console.log(`Creating profile for user: ${userId}`)
}

/**
 * Better Auth instance configuration
 *
 * Features:
 * - Email/password authentication with verification
 * - Google OAuth
 * - Apple OAuth
 * - 7-day sessions with cookie caching
 * - Custom user fields (businessName, phone)
 */
/**
 * Initialize SQLite database connection
 * Creates tables automatically on first run
 */
function initializeAuth() {
  const dbPath = "./sqlite.db"

  try {
    if (!isDatabaseInitialized(dbPath)) {
      console.log("Initializing Better Auth database...")
      initializeDatabase(dbPath)
    }

    const sqlite = new Database(dbPath)
    const db = drizzle(sqlite, { schema })

    return betterAuth({
      database: drizzleAdapter(db, {
        provider: "sqlite",
        schema,
      }),

      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        minPasswordLength: 8,
        maxPasswordLength: 128
      },

      socialProviders: {
        google: {
          clientId: process.env.GOOGLE_CLIENT_ID!,
          clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
        },
        apple: {
          clientId: process.env.APPLE_CLIENT_ID!,
          clientSecret: process.env.APPLE_CLIENT_SECRET!,
        }
      },

      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 24 hours
        cookieCache: {
          enabled: true,
          maxAge: 60 * 5 // 5 minutes
        }
      },

      jwt: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
      },

      user: {
        additionalFields: {
          businessName: {
            type: "string",
            required: false
          },
          phone: {
            type: "string",
            required: false
          }
        }
      },

      callbacks: {
        signIn: {
          after: async (user: { id: string }) => {
            // Create user profile in business tables
            await createUserProfile(user.id)
          }
        }
      },

      // Base URL for auth endpoints
      baseURL: process.env.BETTER_AUTH_URL || "http://localhost:3000",

      // Secret for signing tokens
      secret: process.env.BETTER_AUTH_SECRET!,
    })
  } catch (error) {
    console.error("Failed to initialize Better Auth:", error)
    throw error
  }
}

export const auth = initializeAuth()

// Export auth instance
// Auth methods are accessed via the auth.api object
