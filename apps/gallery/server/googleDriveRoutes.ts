import { Readable } from "node:stream";
import type { Express, Request, Response } from "express";
import { encryptRefreshToken, exchangeDriveCode, fetchDriveMedia, fetchDriveThumbnail, getDriveIdentity, verifyDriveOAuthState } from "./googleDrive";
import { getGoogleDriveSource, upsertGoogleDriveSource } from "./db";
import { verifyDriveAccessGrant } from "./session";

export function getApiOrigin(req: Request) { const protocol = (req.headers["x-forwarded-proto"] as string | undefined)?.split(",")[0] || req.protocol || "https"; return `${protocol}://${req.get("host")}`; }
export function getDriveCallbackUri(req: Request) { return `${getApiOrigin(req)}/api/google-drive/callback`; }
export function allowedDriveReturnUris() {
  const configured = (process.env.GALLERY_WEB_RETURN_ORIGINS ?? "").split(",").map((value: string) => value.trim()).filter(Boolean).map((origin: string) => `${origin.replace(/\/$/, "")}/oauth/drive`);
  if (process.env.NODE_ENV !== "production") configured.push("http://localhost:8081/oauth/drive", "http://127.0.0.1:8081/oauth/drive");
  return configured;
}
export function isAllowedDriveReturnUri(returnUri: string) { return allowedDriveReturnUris().includes(returnUri) || /^ollamabinsaden-gallery:\/\/oauth\/drive(?:\?.*)?$/i.test(returnUri) || /^exp:\/\/[^/]+\/--\/oauth\/drive(?:\?.*)?$/i.test(returnUri); }
function redirectResult(res: Response, returnUri: string, result: "connected" | "cancelled" | "error", sourceId?: number) { const target = new URL(returnUri); target.searchParams.set("drive", result); if (sourceId) target.searchParams.set("sourceId", String(sourceId)); res.redirect(302, target.toString()); }
function pipe(upstream: globalThis.Response, res: Response) { res.status(upstream.status); for (const header of ["content-type", "content-length", "content-range", "accept-ranges", "cache-control"]) { const value = upstream.headers.get(header); if (value) res.setHeader(header, value); } if (!upstream.body) return res.end(); Readable.fromWeb(upstream.body as any).pipe(res); }

export function registerGoogleDriveRoutes(app: Express) {
  app.get("/api/google-drive/callback", async (req, res) => {
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    const oauthError = typeof req.query.error === "string" ? req.query.error : undefined;
    if (!state) { res.status(400).send("Missing OAuth state"); return; }
    let returnUri: string | undefined;
    try {
      const verified = verifyDriveOAuthState(state); returnUri = verified.returnUri;
      if (!isAllowedDriveReturnUri(returnUri)) throw new Error("Invalid return URI");
      if (oauthError) { redirectResult(res, returnUri, oauthError === "access_denied" ? "cancelled" : "error"); return; }
      if (!code) { redirectResult(res, returnUri, "error"); return; }
      const tokens = await exchangeDriveCode(code, getDriveCallbackUri(req)); const identity = await getDriveIdentity(tokens.accessToken);
      const sourceId = await upsertGoogleDriveSource({ ownerKey: verified.ownerId, providerAccountId: identity.providerAccountId, displayName: identity.displayName, email: identity.email, refreshTokenEncrypted: encryptRefreshToken(tokens.refreshToken), grantedScopes: tokens.scope });
      redirectResult(res, returnUri, "connected", sourceId);
    } catch (error) { console.error("[Google Drive] OAuth callback failed", error); if (returnUri) { redirectResult(res, returnUri, "error"); return; } res.status(400).send("Google Drive authorization failed."); }
  });
  app.get("/api/google-drive/media/:sourceId/:fileId", async (req, res) => {
    try { const sourceId = Number(req.params.sourceId); const grantToken = typeof req.query.grant === "string" ? req.query.grant : ""; const grant = verifyDriveAccessGrant(grantToken, { sourceId, fileId: req.params.fileId, kind: "media" }); const source = await getGoogleDriveSource(grant.ownerId, sourceId); if (!source) { res.status(404).send("Drive source not found"); return; } pipe(await fetchDriveMedia(source.refreshTokenEncrypted, req.params.fileId, req.headers.range), res); } catch { res.status(401).send("Unauthorized media request"); }
  });
  app.get("/api/google-drive/thumbnail/:sourceId/:fileId", async (req, res) => {
    try { const sourceId = Number(req.params.sourceId); const grantToken = typeof req.query.grant === "string" ? req.query.grant : ""; const grant = verifyDriveAccessGrant(grantToken, { sourceId, fileId: req.params.fileId, kind: "thumbnail" }); const source = await getGoogleDriveSource(grant.ownerId, sourceId); if (!source) { res.status(404).send("Drive source not found"); return; } pipe(await fetchDriveThumbnail(source.refreshTokenEncrypted, req.params.fileId), res); } catch { res.status(401).send("Unauthorized thumbnail request"); }
  });
}
