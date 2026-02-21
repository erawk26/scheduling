/**
 * Better Auth Configuration
 *
 * Authentication setup following tech_requirements_guide.md (lines 385-446)
 * Uses Better Auth with Drizzle adapter and SQLite
 *
 * Environment variables (auto-read by Better Auth):
 * - BETTER_AUTH_SECRET - Encryption secret (min 32 chars)
 * - BETTER_AUTH_URL - Base URL (e.g., http://localhost:3000)
 */

import { betterAuth } from "better-auth"
import { drizzleAdapter } from "better-auth/adapters/drizzle"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./db/schema"
import { initializeDatabase, isDatabaseInitialized } from "./db/init"

/**
 * Better Auth instance configuration
 *
 * Features:
 * - Email/password authentication
 * - Google OAuth (when configured)
 * - Apple OAuth (when configured)
 * - 7-day sessions with cookie caching
 * - Custom user fields (businessName, phone)
 */
function initializeAuth() {
  const dbPath = "./sqlite.db"

  try {
    if (!isDatabaseInitialized(dbPath)) {
      initializeDatabase(dbPath)
    }

    const sqlite = new Database(dbPath)
    const db = drizzle(sqlite, { schema })

    // Only include social providers when env vars are configured
    const socialProviders: Record<string, { clientId: string; clientSecret: string }> = {}

    if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
      socialProviders.google = {
        clientId: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      }
    }

    if (process.env.APPLE_CLIENT_ID && process.env.APPLE_CLIENT_SECRET) {
      socialProviders.apple = {
        clientId: process.env.APPLE_CLIENT_ID,
        clientSecret: process.env.APPLE_CLIENT_SECRET,
      }
    }

    return betterAuth({
      database: drizzleAdapter(db, {
        provider: "sqlite",
        schema,
      }),

      emailAndPassword: {
        enabled: true,
        requireEmailVerification: false,
        minPasswordLength: 8,
        maxPasswordLength: 128,
      },

      socialProviders,

      session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 days
        updateAge: 60 * 60 * 24, // 24 hours
        cookieCache: {
          enabled: true,
          maxAge: 60 * 5, // 5 minutes
        },
      },

      user: {
        additionalFields: {
          businessName: {
            type: "string",
            required: false,
          },
          phone: {
            type: "string",
            required: false,
          },
        },
      },

      databaseHooks: {
        user: {
          create: {
            after: async (user) => {
              // TODO: Create initial profile in business tables after signup
              // This will be handled by the database/sync implementation
              void user
            },
          },
        },
      },
    })
  } catch (error) {
    console.error("Failed to initialize Better Auth:", error)
    throw error
  }
}

export const auth = initializeAuth()
