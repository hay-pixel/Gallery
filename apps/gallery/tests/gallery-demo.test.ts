import { describe, expect, it } from "vitest";
import { snapshotFromFixtures } from "../lib/catalogue/fixture-adapter";
import { initialLibrary, removeDemoAssets } from "../lib/catalogue/demo";

describe("explicit demo data", () => {
  it("starts a new library empty instead of silently importing sample files", () => {
    expect(initialLibrary(null).canonical_assets).toEqual([]);
  });
  it("restores the existing saved library without replacing it", () => {
    const existing = snapshotFromFixtures(true);
    existing.annotations[existing.canonical_assets[0].asset_id].userNotes =
      "keep my note";
    expect(initialLibrary(existing)).toEqual(existing);
  });
  it("exits demo without removing imported real files or their annotations", () => {
    const mixed = snapshotFromFixtures(true);
    const real = {
      ...mixed.canonical_assets[0],
      asset_id: `sha256:${"f".repeat(64)}`,
      content_hash: `sha256:${"f".repeat(64)}`,
      storage_locator: "owned/real.png",
    };
    mixed.canonical_assets.push(real);
    mixed.annotations[real.asset_id] = {
      asset_id: real.asset_id,
      reviewState: "APPROVED",
      userNotes: "real note",
      labels: [],
      updated_at: "2026-11-11",
    };
    const result = removeDemoAssets(mixed);
    expect(result.canonical_assets).toEqual([real]);
    expect(result.annotations[real.asset_id].userNotes).toBe("real note");
    expect(result.source_occurrences).toEqual([]);
    expect(mixed.canonical_assets.length).toBeGreaterThan(1);
  });
});
