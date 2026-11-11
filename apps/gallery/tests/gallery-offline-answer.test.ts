import { describe, expect, it } from "vitest";
import { offlineArchiveAnswer } from "../lib/search/offline-answer";
import { snapshotFromFixtures } from "../lib/catalogue/fixture-adapter";
import { buildAllCatalogueAssetViews } from "../lib/catalogue/view-model";

describe("offline archive answers", () => {
  it("does not answer from sample files absent from the current library", () => {
    const result = offlineArchiveAnswer([], "speaker wires");
    expect(result.supporting_assets).toEqual([]);
    expect(result.answer).toContain("No matching items");
    expect(result.offline).toBe(true);
  });
  it("returns only matching assets from the supplied catalogue", () => {
    const view = buildAllCatalogueAssetViews(snapshotFromFixtures(true))[0];
    view.displayName = "unique-imported-photo.png";
    const result = offlineArchiveAnswer([view], "unique-imported");
    expect(result.supporting_assets).toEqual([
      { asset_id: view.asset.asset_id },
    ]);
    expect(result.answer).toContain("1 matching item");
    expect(result.limitations).toContain(
      "Local text matching only. No AI answer was generated.",
    );
  });
});
