import { afterEach, describe, expect, it, vi } from "vitest";
import { encryptRefreshToken, listDriveFiles } from "../server/googleDrive";

describe("Google Drive pagination and access-token reuse", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("follows nextPageToken and refreshes access only once", async () => {
    process.env.JWT_SECRET = "pagination-test-secret"; process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID = "client"; process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET = "secret";
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL) => { const url = String(input); calls.push(url); if (url.includes("oauth2.googleapis.com")) return new Response(JSON.stringify({ access_token: "access", expires_in: 3600 }), { status: 200 }); const token = new URL(url).searchParams.get("pageToken"); return new Response(JSON.stringify(token ? { files: [{ id: "second" }] } : { files: [{ id: "first" }], nextPageToken: "page-2" }), { status: 200 }); }));
    const files = await listDriveFiles(encryptRefreshToken("refresh"));
    expect(files.map((file) => file.id)).toEqual(["first", "second"]);
    expect(calls.filter((url) => url.includes("oauth2.googleapis.com"))).toHaveLength(1);
    expect(calls.some((url) => url.includes("pageToken=page-2"))).toBe(true);
  });
});
