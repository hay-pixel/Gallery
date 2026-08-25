import { beforeEach, describe, expect, it } from "vitest";
import { isAllowedDriveReturnUri } from "../server/googleDriveRoutes";
describe("Gallery OAuth return URI allowlist", () => {
  beforeEach(() => { process.env.NODE_ENV = "production"; process.env.GALLERY_WEB_RETURN_ORIGINS = "https://gallery.example,http://localhost:8081"; });
  it("allows configured web and owned native callbacks", () => { expect(isAllowedDriveReturnUri("https://gallery.example/oauth/drive")).toBe(true); expect(isAllowedDriveReturnUri("http://localhost:8081/oauth/drive")).toBe(true); expect(isAllowedDriveReturnUri("ollamabinsaden-gallery://oauth/drive")).toBe(true); });
  it("rejects API, lookalike, and template host callbacks", () => { expect(isAllowedDriveReturnUri("https://api.example/oauth/drive")).toBe(false); expect(isAllowedDriveReturnUri("https://gallery.example.evil/oauth/drive")).toBe(false); expect(isAllowedDriveReturnUri("https://3000-template.example/oauth/drive")).toBe(false); });
});

it("validates cancelled OAuth state and redirects with a typed status", async () => {
  process.env.JWT_SECRET = "cancel-test-secret"; process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID = "client";
  const { createDriveAuthorizationUrl } = await import("../server/googleDrive");
  const { registerGoogleDriveRoutes } = await import("../server/googleDriveRoutes");
  const authorization = new URL(createDriveAuthorizationUrl({ ownerId: "123e4567-e89b-12d3-a456-426614174000", returnUri: "https://gallery.example/oauth/drive", redirectUri: "https://api.example/api/google-drive/callback" }));
  const handlers = new Map<string, Function>(); registerGoogleDriveRoutes({ get: (path: string, handler: Function) => handlers.set(path, handler) } as any);
  const res = { redirect: (status: number, target: string) => { expect(status).toBe(302); expect(target).toBe("https://gallery.example/oauth/drive?drive=cancelled"); }, status: () => res, send: () => undefined };
  await handlers.get("/api/google-drive/callback")!({ query: { error: "access_denied", state: authorization.searchParams.get("state") } }, res);
});
