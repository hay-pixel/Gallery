import { describe, expect, it } from "vitest";

describe("Google OAuth client configuration", () => {
  it("is accepted by Google’s token endpoint", async () => {
    const clientId = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_DRIVE_OAUTH_CLIENT_SECRET;

    // Open-source and fixture evaluation must not require a committed OAuth
    // client secret. The live check activates automatically in configured
    // deployment environments.
    if (!clientId || !clientSecret) {
      expect(clientId || clientSecret).toBeFalsy();
      return;
    }

    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId!,
        client_secret: clientSecret!,
        grant_type: "refresh_token",
        refresh_token: "pixeldrive-credential-validation-only",
      }),
    });
    const body = await response.json() as { error?: string };

    // A valid client reaches grant validation; the deliberately invalid refresh
    // token must not be accepted and must not produce an invalid_client error.
    expect(response.status).toBe(400);
    expect(body.error).toBe("invalid_grant");
  }, 15_000);
});
