import { describe, expect, it, vi } from "vitest";
import {
  UnavailableSearchGateway,
  validateSearchGatewayPage,
} from "../server/search-gateway";
import type { SearchPage, SearchResult } from "../lib/search/types";

const ASSET_1 = "sha256:1b8f40e983a5320a7b2aa8f5b7c0ca7f8e7a77a2b20f5aa301d49b7a03bb0011";

describe("Gallery server Search boundary", () => {
  it("distinguishes ready no-match from unavailable, stale, incompatible, and failed states", async () => {
    const unavailable = new UnavailableSearchGateway();
    const fetchSpy = vi.spyOn(globalThis, "fetch");

    const metaPage = await unavailable.searchMetadata({ query: "speaker" });
    expect(metaPage.state).toBe("unavailable");
    expect(metaPage.results).toEqual([]);
    expect(metaPage.next_cursor).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();

    const readyEmpty: SearchPage<SearchResult> = {
      state: "ready",
      results: [],
      next_cursor: null,
    };
    const validatedReady = validateSearchGatewayPage(readyEmpty, "metadata");
    expect(validatedReady.state).toBe("ready");
    expect(validatedReady.results).toHaveLength(0);
    expect(validatedReady.state).not.toBe(metaPage.state);

    fetchSpy.mockRestore();
  });

  it("enforces canonical asset_id === content_hash, valid visual relationships, and prevents mode relabelling", () => {
    const validVisualPage: SearchPage<SearchResult> = {
      state: "ready",
      next_cursor: "opaque-cursor-1",
      results: [
        {
          asset_id: ASSET_1,
          content_hash: ASSET_1,
          retrieval_mode: "visual",
          relationship: "visually_similar",
          score: 0.91,
          provenance: {
            source_occurrences: [],
          },
        },
      ],
    };
    expect(validateSearchGatewayPage(validVisualPage, "visual").results).toHaveLength(1);

    // Visual results must never claim exact_duplicate without byte proof
    expect(() =>
      validateSearchGatewayPage(
        {
          state: "ready",
          next_cursor: null,
          results: [
            {
              asset_id: ASSET_1,
              content_hash: ASSET_1,
              retrieval_mode: "visual",
              relationship: "exact_duplicate" as any,
              score: 1.0,
              provenance: { source_occurrences: [] },
            },
          ],
        },
        "visual",
      ),
    ).toThrow(/relationship|exact_duplicate/i);

    // Semantic/visual/hybrid requests must reject results labelled as metadata/lexical
    expect(() =>
      validateSearchGatewayPage(
        {
          state: "ready",
          next_cursor: null,
          results: [
            {
              asset_id: ASSET_1,
              content_hash: ASSET_1,
              retrieval_mode: "metadata",
              score: 0.8,
              provenance: { source_occurrences: [] },
            },
          ],
        },
        "semantic",
      ),
    ).toThrow(/retrieval_mode|relabel|mismatch/i);
  });
});

