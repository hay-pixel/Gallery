import { isValidAssetId } from "../lib/catalogue/contracts";
import type {
  SearchAvailability,
  SearchPage,
  SearchQueryInput,
  SearchResult,
  SearchRetrievalMode,
  VisualSimilarityInput,
} from "../lib/search/types";

export interface SearchGateway {
  getSearchState(): Promise<Record<SearchRetrievalMode, SearchAvailability>>;
  searchMetadata(input: SearchQueryInput): Promise<SearchPage<SearchResult>>;
  searchSemantic(input: SearchQueryInput): Promise<SearchPage<SearchResult>>;
  findVisuallySimilar(input: VisualSimilarityInput): Promise<SearchPage<SearchResult>>;
  searchHybrid(input: SearchQueryInput): Promise<SearchPage<SearchResult>>;
}

export function validateSearchGatewayPage(
  page: SearchPage<SearchResult>,
  expectedMode: SearchRetrievalMode,
): SearchPage<SearchResult> {
  if (page.state !== "ready" && page.results.length > 0) {
    throw new Error(`Non-ready search page (${page.state}) must not return results`);
  }

  for (const item of page.results) {
    if (!isValidAssetId(item.asset_id) || !isValidAssetId(item.content_hash)) {
      throw new Error(`Invalid canonical asset_id or content_hash in search result: ${item.asset_id}`);
    }
    if (item.asset_id !== item.content_hash) {
      throw new Error("Search result asset_id must equal content_hash");
    }
    if (item.retrieval_mode !== expectedMode) {
      throw new Error(
        `Search retrieval_mode mismatch: expected "${expectedMode}", got "${item.retrieval_mode}" (cannot relabel results across modes)`,
      );
    }
    if (expectedMode === "visual") {
      if (
        item.relationship !== "visually_similar" &&
        item.relationship !== "near_duplicate_candidate"
      ) {
        throw new Error(
          `Invalid visual search relationship "${String(item.relationship)}": visual similarity must not claim exact_duplicate without byte proof`,
        );
      }
    }
  }

  return structuredClone(page);
}

export class UnavailableSearchGateway implements SearchGateway {
  async getSearchState(): Promise<Record<SearchRetrievalMode, SearchAvailability>> {
    return {
      metadata: "unavailable",
      semantic: "unavailable",
      visual: "unavailable",
      hybrid: "unavailable",
    };
  }

  async searchMetadata(_input: SearchQueryInput): Promise<SearchPage<SearchResult>> {
    return {
      state: "unavailable",
      results: [],
      next_cursor: null,
      detail: "Metadata Search service is not connected; use local catalogue browse.",
    };
  }

  async searchSemantic(_input: SearchQueryInput): Promise<SearchPage<SearchResult>> {
    return {
      state: "unavailable",
      results: [],
      next_cursor: null,
      detail: "Semantic Search index is unavailable.",
    };
  }

  async findVisuallySimilar(
    _input: VisualSimilarityInput,
  ): Promise<SearchPage<SearchResult>> {
    return {
      state: "unavailable",
      results: [],
      next_cursor: null,
      detail: "Visual similarity Search index is unavailable.",
    };
  }

  async searchHybrid(_input: SearchQueryInput): Promise<SearchPage<SearchResult>> {
    return {
      state: "unavailable",
      results: [],
      next_cursor: null,
      detail: "Hybrid Search index is unavailable.",
    };
  }
}

export const defaultSearchGateway: SearchGateway = new UnavailableSearchGateway();

