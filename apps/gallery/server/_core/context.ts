import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import { sessionTokenFromRequest, verifyGallerySession, type GallerySession } from "../session";
export type TrpcContext = Pick<CreateExpressContextOptions, "req" | "res"> & { session: GallerySession | null };
export function createContext({ req, res }: CreateExpressContextOptions): TrpcContext {
  const token = sessionTokenFromRequest(req);
  let session: GallerySession | null = null;
  if (token) try { session = verifyGallerySession(token); } catch { session = null; }
  return { req, res, session };
}
