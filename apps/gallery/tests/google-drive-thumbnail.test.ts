import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptRefreshToken, fetchDriveThumbnail } from "../server/googleDrive";
describe("bounded Drive thumbnail proxy", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("resolves a server-owned file ID and reuses one access token", async () => {
    process.env.JWT_SECRET = "thumbnail-test-secret"; process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID = "client"; process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = "secret";
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => { const url = String(input); calls.push(url); if (url.includes("oauth2.googleapis.com")) return new Response(JSON.stringify({ access_token: "access", expires_in: 3600 }), { status: 200 }); if (url.includes("googleapis.com/drive/v3/files/drive-file")) return new Response(JSON.stringify({ thumbnailLink: "https://lh3.googleusercontent.com/thumb" }), { status: 200 }); return new Response("thumb", { status: 200 }); }));
    const response = await fetchDriveThumbnail(encryptRefreshToken("refresh-thumbnail"), "drive-file");
    expect(await response.text()).toBe("thumb");
    expect(calls.filter((url) => url.includes("oauth2.googleapis.com"))).toHaveLength(1);
    expect(calls.at(-1)).toContain("sz=w400-h400");
  });
});
