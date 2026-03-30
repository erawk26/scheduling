/**
 * Better Auth Configuration
 *
 * Authentication setup following tech_requirements_guide.md.
 * Uses better-sqlite3 for persistent server-side auth DB.
 * App data is handled by OfflineKit; auth is handled by Better Auth.
 *
 * Environment variables (auto-read by Better Auth):
 * - BETTER_AUTH_SECRET - Encryption secret (min 32 chars)
 * - BETTER_AUTH_URL - Base URL (e.g., http://localhost:3000)
 */

import { betterAuth } from "better-auth"
import { bearer, jwt, magicLink } from "better-auth/plugins"
import { tanstackStartCookies } from "better-auth/tanstack-start"
import Database from "better-sqlite3"
import path from "path"
import fs from "fs"

const dbDir = path.resolve(process.cwd(), "data")
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true })
}
const db = new Database(path.join(dbDir, "auth.db"))

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

export const auth = betterAuth({
  database: db,

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

  plugins: [
    bearer(),
    jwt({
      jwks: {
        keyPairConfig: {
          alg: "RS256",
        },
      },
      jwt: {
        issuer: process.env.BETTER_AUTH_URL || "http://localhost:3000",
        audience: process.env.BETTER_AUTH_URL || "http://localhost:3000",
        expirationTime: "1h",
        definePayload: (user) => ({
          sub: user.user.id,
          email: user.user.email,
        }),
      },
    }),
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        // TODO: Integrate with Resend or other email service (Phase 4)
        if (process.env.NODE_ENV === "development") {
          // eslint-disable-next-line no-console
          console.log(`[MagicLink] Dev-only: ${email} -> ${url}`)
        }
      },
    }),
    tanstackStartCookies(),
  ],
})
