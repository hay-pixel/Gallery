import { int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Legacy application account identifier. Unique per user. */
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/** Server-owned, encrypted credentials for independently connected read-only Drive sources. */
export const googleDriveSources = mysqlTable(
  "google_drive_sources",
  {
    id: int("id").autoincrement().primaryKey(),
    /** A high-entropy identifier held in device secure storage, not a Google credential. */
    ownerKey: varchar("ownerKey", { length: 64 }).notNull(),
    providerAccountId: varchar("providerAccountId", { length: 255 }).notNull(),
    displayName: varchar("displayName", { length: 255 }).notNull(),
    email: varchar("email", { length: 320 }),
    refreshTokenEncrypted: text("refreshTokenEncrypted").notNull(),
    grantedScopes: text("grantedScopes").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
    lastIndexedAt: timestamp("lastIndexedAt"),
  },
  (table) => [uniqueIndex("google_drive_sources_owner_account_unique").on(table.ownerKey, table.providerAccountId)],
);

export type GoogleDriveSource = typeof googleDriveSources.$inferSelect;
export type InsertGoogleDriveSource = typeof googleDriveSources.$inferInsert;
