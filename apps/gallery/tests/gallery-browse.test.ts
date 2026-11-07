import { describe, expect, it } from "vitest";
import { browseCatalogue } from "../lib/catalogue/browse";
import { snapshotFromFixtures } from "../lib/catalogue/fixture-adapter";
import { buildAllCatalogueAssetViews } from "../lib/catalogue/view-model";

describe("Gallery in-memory catalogue browse", () => {
  it("filters canonical views by query, MIME, category, source, reviewState, and returns immutable views", () => {
    const snapshot = snapshotFromFixtures(true);
    const views = buildAllCatalogueAssetViews(snapshot);

    const all = browseCatalogue(views);
    expect(all.length).toBe(views.length);

    const byQuery = browseCatalogue(views, "speaker wires", { showSidecars: false });
    expect(byQuery).toHaveLength(1);
    expect(byQuery[0]?.displayName).toBe("speaker_wires_circled.jpg");

    const byMime = browseCatalogue(views, "", { mimePrefix: "video/" });
    expect(byMime).toHaveLength(1);
    expect(byMime[0]?.asset.mime_type).toBe("video/mp4");

    const byReview = browseCatalogue(views, "", { reviewState: "NEEDS_REVIEW" });
    expect(byReview.length).toBeGreaterThan(0);
    expect(byReview.every((v) => v.annotations.reviewState === "NEEDS_REVIEW")).toBe(true);

    // Ensure returned views are deep clones and contain no Search provenance fields
    const first = byQuery[0]!;
    expect((first as Record<string, unknown>).retrieval_mode).toBeUndefined();
    expect((first as Record<string, unknown>).score).toBeUndefined();
    expect((first as Record<string, unknown>).index_profile).toBeUndefined();

    first.annotations.userNotes = "Mutated in caller";
    expect(views.find((v) => v.asset.asset_id === first.asset.asset_id)?.annotations.userNotes).not.toBe(
      "Mutated in caller",
    );
  });
});
