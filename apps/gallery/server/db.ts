import { and, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { assets, googleDriveSources, InsertGoogleDriveSource } from "../drizzle/schema";

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

export async function listGoogleDriveSources(ownerKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db
    .select({
      id: googleDriveSources.id,
      displayName: googleDriveSources.displayName,
      email: googleDriveSources.email,
      grantedScopes: googleDriveSources.grantedScopes,
      createdAt: googleDriveSources.createdAt,
      updatedAt: googleDriveSources.updatedAt,
      lastIndexedAt: googleDriveSources.lastIndexedAt,
    })
    .from(googleDriveSources)
    .where(eq(googleDriveSources.ownerKey, ownerKey));
}

export async function upsertGoogleDriveSource(input: InsertGoogleDriveSource) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");

  const existing = await db
    .select({ id: googleDriveSources.id })
    .from(googleDriveSources)
    .where(and(eq(googleDriveSources.ownerKey, input.ownerKey), eq(googleDriveSources.providerAccountId, input.providerAccountId)))
    .limit(1);

  if (existing[0]) {
    await db.update(googleDriveSources).set({
      displayName: input.displayName,
      email: input.email,
      refreshTokenEncrypted: input.refreshTokenEncrypted,
      grantedScopes: input.grantedScopes,
      updatedAt: new Date(),
    }).where(eq(googleDriveSources.id, existing[0].id));
    return existing[0].id;
  }

  const result = await db.insert(googleDriveSources).values(input);
  return Number(result[0].insertId);
}

export async function getGoogleDriveSource(ownerKey: string, sourceId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  const result = await db.select().from(googleDriveSources).where(and(eq(googleDriveSources.ownerKey, ownerKey), eq(googleDriveSources.id, sourceId))).limit(1);
  return result[0];
}

export async function listGoogleDriveSourceRecords(ownerKey: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  return db.select().from(googleDriveSources).where(eq(googleDriveSources.ownerKey, ownerKey));
}

export async function listCatalogueAssets() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(assets);
}

export async function getAssetById(assetId: string) {
  const db = await getDb();
  if (!db) return null;
  const res = await db.select().from(assets).where(eq(assets.assetId, assetId)).limit(1);
  return res[0] ?? null;
}

export async function updateAssetReviewState(
  assetId: string,
  reviewState: "NEEDS_REVIEW" | "APPROVED" | "SKIPPED",
  reviewEvidence?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db
    .update(assets)
    .set({
      reviewState,
      reviewEvidence: reviewEvidence ?? null,
      updatedAt: new Date(),
    })
    .where(eq(assets.assetId, assetId));
}

export async function updateAssetCategory(
  assetId: string,
  primaryCategory: string,
  subcategory?: string,
) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  await db
    .update(assets)
    .set({
      primaryCategory,
      subcategory: subcategory ?? null,
      updatedAt: new Date(),
    })
    .where(eq(assets.assetId, assetId));
}

export async function setDuplicatePreference(assetId: string, duplicateGroupId: string) {
  const db = await getDb();
  if (!db) throw new Error("Database is unavailable");
  // Clear any existing preference in the group
  await db
    .update(assets)
    .set({ isPreferredCopy: 0 })
    .where(eq(assets.duplicateGroupId, duplicateGroupId));
  // Set preferred copy
  await db
    .update(assets)
    .set({ isPreferredCopy: 1, updatedAt: new Date() })
    .where(eq(assets.assetId, assetId));
}
