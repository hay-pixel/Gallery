import { describe, expect, it } from "vitest";

import { createDriveAuthorizationUrl, DRIVE_VIEW_SCOPE, verifyDriveOAuthState } from "../server/googleDrive";

describe("Google Drive OAuth state", () => {
  it("uses a signed, short-lived state and requests only metadata-readonly access", () => {
    const original = process.env.JWT_SECRET;
    process.env.JWT_SECRET = "test-state-secret";
    process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID = "gallery-test-client";
    const url = new URL(createDriveAuthorizationUrl({
      ownerId: "123e4567-e89b-12d3-a456-426614174000",
      returnUri: "ollamabinsaden-gallery://oauth/drive",
      redirectUri: "https://example.test/api/google-drive/callback",
    }));

    expect(url.searchParams.get("scope")).toBe(DRIVE_VIEW_SCOPE);
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("redirect_uri")).toBe("https://example.test/api/google-drive/callback");

    const state = verifyDriveOAuthState(url.searchParams.get("state")!);
    expect(state.ownerId).toBe("123e4567-e89b-12d3-a456-426614174000");
    expect(state.returnUri).toBe("ollamabinsaden-gallery://oauth/drive");

    process.env.JWT_SECRET = original;
  });
});
