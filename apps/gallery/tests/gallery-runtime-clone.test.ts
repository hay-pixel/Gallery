import { expect, it, vi } from "vitest";
import { snapshotFromFixtures } from "../lib/catalogue/fixture-adapter";
import { buildAllCatalogueAssetViews } from "../lib/catalogue/view-model";
import { browseCatalogue } from "../lib/catalogue/browse";
it("browses saved records when the native runtime lacks structuredClone", () => {
  const snapshot = snapshotFromFixtures(true);
  vi.stubGlobal("structuredClone", undefined);
  try {
    const views = buildAllCatalogueAssetViews(snapshot);
    expect(browseCatalogue(views, "speaker")[0].displayName).toBe(
      "speaker_wires_circled.jpg",
    );
  } finally {
    vi.unstubAllGlobals();
  }
});
