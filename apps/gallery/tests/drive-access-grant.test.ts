import { describe, expect, it } from "vitest";
import { createDriveAccessGrant, verifyDriveAccessGrant } from "../server/session";
describe("scoped Drive access grants", () => {
  it("cannot be reused for another source, file, or media kind", () => {
    process.env.JWT_SECRET = "grant-test-secret";
    const token = createDriveAccessGrant({ ownerId: "123e4567-e89b-12d3-a456-426614174000", sourceId: 7, fileId: "one", kind: "thumbnail" });
    expect(verifyDriveAccessGrant(token, { sourceId: 7, fileId: "one", kind: "thumbnail" }).ownerId).toContain("123e4567");
    expect(() => verifyDriveAccessGrant(token, { sourceId: 8, fileId: "one", kind: "thumbnail" })).toThrow();
    expect(() => verifyDriveAccessGrant(token, { sourceId: 7, fileId: "two", kind: "thumbnail" })).toThrow();
    expect(() => verifyDriveAccessGrant(token, { sourceId: 7, fileId: "one", kind: "media" })).toThrow();
  });
});
