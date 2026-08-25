import crypto from "node:crypto";
import type { Request } from "express";

export type GallerySession = { ownerId: string; expiresAt: number };
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;

function key() {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is required for Gallery sessions");
  return crypto.createHash("sha256").update(`gallery-session:${secret}`).digest();
}
function encode(value: Buffer | string) { return Buffer.from(value).toString("base64url"); }

export function createGallerySession(ownerId = crypto.randomUUID()): { token: string; session: GallerySession } {
  const session = { ownerId, expiresAt: Date.now() + SESSION_TTL_MS };
  const payload = encode(JSON.stringify(session));
  const signature = encode(crypto.createHmac("sha256", key()).update(payload).digest());
  return { token: `${payload}.${signature}`, session };
}

export function verifyGallerySession(token: string): GallerySession {
  const [payload, encodedSignature] = token.split(".");
  if (!payload || !encodedSignature) throw new Error("Invalid Gallery session");
  const expected = crypto.createHmac("sha256", key()).update(payload).digest();
  const actual = Buffer.from(encodedSignature, "base64url");
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) throw new Error("Invalid Gallery session signature");
  const session = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as GallerySession;
  if (!/^[0-9a-f-]{36}$/i.test(session.ownerId) || session.expiresAt <= Date.now()) throw new Error("Expired Gallery session");
  return session;
}

export function sessionTokenFromRequest(req: Request): string | undefined {
  const auth = req.header("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return undefined;
}

export type DriveAccessGrant = { ownerId: string; sourceId: number; fileId: string; kind: "media" | "thumbnail"; expiresAt: number };
export function createDriveAccessGrant(input: Omit<DriveAccessGrant, "expiresAt">): string {
  const payload = encode(JSON.stringify({ ...input, expiresAt: Date.now() + 5 * 60 * 1000 }));
  const signature = encode(crypto.createHmac("sha256", key()).update(`drive:${payload}`).digest());
  return `${payload}.${signature}`;
}
export function verifyDriveAccessGrant(token: string, expected: Pick<DriveAccessGrant, "sourceId" | "fileId" | "kind">): DriveAccessGrant {
  const [payload, encodedSignature] = token.split(".");
  if (!payload || !encodedSignature) throw new Error("Invalid Drive access grant");
  const wanted = crypto.createHmac("sha256", key()).update(`drive:${payload}`).digest();
  const actual = Buffer.from(encodedSignature, "base64url");
  if (actual.length !== wanted.length || !crypto.timingSafeEqual(actual, wanted)) throw new Error("Invalid Drive access grant signature");
  const grant = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as DriveAccessGrant;
  if (grant.expiresAt <= Date.now() || grant.sourceId !== expected.sourceId || grant.fileId !== expected.fileId || grant.kind !== expected.kind) throw new Error("Expired or mismatched Drive access grant");
  return grant;
}
