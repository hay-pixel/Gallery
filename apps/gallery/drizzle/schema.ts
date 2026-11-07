import { bigint, int, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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

/** Universal sources (Google Drive, local collections, Extract exports). */
export const sources = mysqlTable("sources", {
  id: int("id").autoincrement().primaryKey(),
  ownerKey: varchar("ownerKey", { length: 64 }).notNull(),
  kind: mysqlEnum("kind", ["google_drive", "local_folder", "extract_export"]).notNull(),
  displayName: varchar("displayName", { length: 255 }).notNull(),
  configJson: text("configJson").notNull(),
  lastSyncedAt: timestamp("lastSyncedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type Source = typeof sources.$inferSelect;
export type InsertSource = typeof sources.$inferInsert;

/** Canonical assets identified by SHA-256 byte digest. */
export const assets = mysqlTable("assets", {
  assetId: varchar("assetId", { length: 71 }).primaryKey(), // "sha256:<64 hex>"
  contentHash: varchar("contentHash", { length: 64 }).notNull(),
  mimeType: varchar("mimeType", { length: 128 }).notNull(),
  sizeBytes: bigint("sizeBytes", { mode: "number" }).notNull(),
  primaryCategory: varchar("primaryCategory", { length: 64 }).notNull(),
  subcategory: varchar("subcategory", { length: 64 }),
  userNotes: text("userNotes"),
  reviewState: mysqlEnum("reviewState", ["NEEDS_REVIEW", "APPROVED", "SKIPPED"]).default("NEEDS_REVIEW").notNull(),
  reviewEvidence: text("reviewEvidence"),
  preferredOccurrenceId: varchar("preferredOccurrenceId", { length: 128 }),
  duplicateGroupId: varchar("duplicateGroupId", { length: 128 }),
  isPreferredCopy: int("isPreferredCopy").default(0).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Asset = typeof assets.$inferSelect;
export type InsertAsset = typeof assets.$inferInsert;

/** Source occurrences recording where canonical assets are located. */
export const sourceOccurrences = mysqlTable("source_occurrences", {
  sourceOccurrenceId: varchar("sourceOccurrenceId", { length: 128 }).primaryKey(),
  assetId: varchar("assetId", { length: 71 }).notNull(),
  sourceId: int("sourceId").notNull(),
  originalPath: text("originalPath").notNull(),
  providerFileId: varchar("providerFileId", { length: 255 }),
  archiveLocation: text("archiveLocation"),
  sourceMember: text("sourceMember"),
  observedSizeBytes: bigint("observedSizeBytes", { mode: "number" }).notNull(),
  observedModifiedAt: timestamp("observedModifiedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type DBSourceOccurrence = typeof sourceOccurrences.$inferSelect;
export type InsertSourceOccurrence = typeof sourceOccurrences.$inferInsert;

/** Background jobs for scanning, hashing, analysis, and indexing. */
export const backgroundJobs = mysqlTable("background_jobs", {
  id: varchar("id", { length: 64 }).primaryKey(),
  ownerKey: varchar("ownerKey", { length: 64 }).notNull(),
  type: mysqlEnum("type", ["scan", "hash_verify", "analysis", "indexing"]).notNull(),
  status: mysqlEnum("status", ["QUEUED", "RUNNING", "COMPLETED", "FAILED"]).notNull(),
  progressPercent: int("progressPercent").default(0).notNull(),
  processedCount: int("processedCount").default(0).notNull(),
  totalCount: int("totalCount").default(0).notNull(),
  detail: text("detail"),
  errorMessage: text("errorMessage"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type BackgroundJob = typeof backgroundJobs.$inferSelect;
export type InsertBackgroundJob = typeof backgroundJobs.$inferInsert;
