import type { AssetId } from "../catalogue/types";

export type SearchAvailability =
  | "ready"
  | "unavailable"
  | "stale"
  | "incompatible"
  | "failed";

export type SearchRetrievalMode = "metadata" | "semantic" | "visual" | "hybrid";

export type VisualSearchRelationship =
  | "visually_similar"
  | "near_duplicate_candidate";

export type SearchResultProvenance = {
  source_occurrences: {
    source_occurrence_id: string;
    source_id: string;
    source_kind: string;
    source_location: string;
    original_path: string;
  }[];
  matched_fields?: string[];
  profile_id?: string;
};

export type SearchResultComponent = {
  family: "metadata" | "semantic" | "visual";
  score: number;
  weight: number;
};

export type SearchResult = {
  asset_id: AssetId;
  content_hash: AssetId;
  retrieval_mode: SearchRetrievalMode;
  relationship?: VisualSearchRelationship;
  score: number;
  provenance: SearchResultProvenance;
  components?: SearchResultComponent[];
};

export type SearchPage<T = SearchResult> = {
  state: SearchAvailability;
  results: T[];
  next_cursor: string | null;
  detail?: string;
};

export type SearchQueryInput = {
  query: string;
  limit?: number;
  cursor?: string | null;
  filters?: Record<string, string | undefined>;
};

export type VisualSimilarityInput = {
  asset_id: AssetId;
  limit?: number;
  cursor?: string | null;
};

