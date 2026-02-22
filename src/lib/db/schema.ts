/**
 * Drizzle Schema for Better Auth
 *
 * Generated schema for Better Auth 0.8.8 with SQLite
 * Based on Better Auth CLI output
 *
 * @see https://better-auth.com/docs/adapters/drizzle
 */

import { sql } from "drizzle-orm"
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core"

/**
 * User table
 * Stores core user authentication data
 */
export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: integer("emailVerified", { mode: "boolean" })
    .default(false)
    .notNull(),
  image: text("image"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(cast(unixepoch() as integer))`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(cast(unixepoch() as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
  // Additional fields from Better Auth config
  businessName: text("businessName"),
  phone: text("phone"),
})

/**
 * Session table
 * Tracks active user sessions
 */
export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique().$defaultFn(() => crypto.randomUUID()),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(cast(unixepoch() as integer))`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(cast(unixepoch() as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
})

/**
 * Account table
 * Links users to OAuth providers and stores credentials
 */
export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  expiresAt: integer("expiresAt", { mode: "timestamp" }),
  accessTokenExpiresAt: integer("accessTokenExpiresAt", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refreshTokenExpiresAt", { mode: "timestamp" }),
  scope: text("scope"),
  password: text("password"),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(cast(unixepoch() as integer))`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(cast(unixepoch() as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
})

/**
 * Verification table
 * Stores email verification tokens
 */
export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expiresAt", { mode: "timestamp" }).notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(cast(unixepoch() as integer))`)
    .notNull(),
  updatedAt: integer("updatedAt", { mode: "timestamp" })
    .default(sql`(cast(unixepoch() as integer))`)
    .$onUpdate(() => new Date())
    .notNull(),
})

/**
 * JWKS table
 * Stores JSON Web Key Sets for JWT plugin
 */
export const jwks = sqliteTable("jwks", {
  id: text("id").primaryKey(),
  publicKey: text("publicKey").notNull(),
  privateKey: text("privateKey").notNull(),
  createdAt: integer("createdAt", { mode: "timestamp" })
    .default(sql`(cast(unixepoch() as integer))`)
    .notNull(),
})

/**
 * Export all tables for Drizzle adapter
 */
export const schema = {
  user,
  session,
  account,
  verification,
  jwks,
}
