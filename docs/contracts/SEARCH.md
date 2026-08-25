# Search Contract

## Purpose

Search is the project-owned retrieval boundary for canonical assets. It provides deterministic metadata retrieval, visual similarity retrieval, semantic/vector retrieval, ranking, index health, and evaluation support behind provider-independent contracts.

Search is not a build-agent service. A temporary worker may implement it, but production Search must keep running after Manus, ChatGPT, Codex, Gemini, or any other build agent is removed.

## Non-negotiable Identity Rules

- Every durable Search result maps to canonical `asset_id`.
- `asset_id` is authoritative and comes from the accepted ingest/asset-schema contract.
- `asset_id` is `sha256:<lowercase SHA-256 hex digest of exact asset bytes>`.
- Search must not define durable identity using temporary paths, filenames, Gallery fixture IDs, Google Drive IDs, Manus IDs, vector-store row numbers, or index-internal IDs.
- Search may return provenance and matched context, but those fields never replace `asset_id`.
- Same SHA-256 content means the same canonical `asset_id`.

## Runtime Position

```text
canonical asset records + source occurrences + analysis records
  -> Search indexes
  -> retrieval / ranking
  -> direct Gallery results or Ollama-grounded reasoning inputs
```

Search must operate when Ollama is offline. Basic Gallery browsing must continue when Search indexes are absent, using canonical asset records directly.

## Retrieval Modes

### Deterministic Metadata

Mode: `metadata`

Use for exact or filterable fields:

- asset ID
- content hash
- MIME/media type
- size range
- source kind
- source location
- original path/name
- archive/member provenance
- date/time fields when available
- tags/categories from accepted analysis records
- OCR exact text where indexed
- analysis status, pending, stale, failed, unsupported

Metadata retrieval must be explainable through matched fields and filter values. It must not require Ollama.

### Visual Similarity

Mode: `visual_similarity`

Use for:

- find images visually similar to this asset
- near-duplicate candidates
- same scene/object/composition
- visual clusters

Visual similarity operates on versioned visual feature records derived from canonical assets and analysis. The query may be an `asset_id` or a feature vector produced by the same compatible visual feature family.

Visual similarity is not exact duplicate detection. It returns candidates with relationship types such as `near_duplicate_candidate` or `visually_similar`, never `exact_duplicate` unless byte identity has already been proven through canonical content hash.

### Semantic Retrieval

Mode: `semantic`

Use for natural-language concepts over text inputs derived from the archive:

- analysis summaries
- normalized tags/categories
- OCR text
- original/source metadata where appropriate
- curated captions or user annotations when later approved

Semantic embeddings are separate from visual feature vectors unless a future architecture decision explicitly proves one shared embedding space is suitable.

### Hybrid Retrieval

Mode: `hybrid`

Hybrid retrieval combines deterministic filters with visual and/or semantic scores. It must report each component contribution and avoid pretending raw scores from incompatible vector families are directly comparable.

Deterministic filters should be pushed into semantic or hybrid operations when possible so candidate generation and ranking operate on the intended subset. For example, `source_kind=camera` plus `red car near beach` should normally execute as one semantic/hybrid operation with `source_kind=camera` as a pre-filter, not as two ambiguous independent result sets.

Hybrid final rank/score must be produced from documented component contributions. Raw component scores may be normalized within their own model/index family before weighting, but raw visual and semantic scores must not be directly compared across incompatible families.

## Result Contract

All Search operations return a stable provider-independent shape:

```json
{
  "asset_id": "sha256:...",
  "score": 0.82,
  "score_kind": "cosine_similarity",
  "retrieval_mode": "semantic",
  "relationship_type": "semantically_related",
  "matched_fields": [
    {
      "field": "analysis.tags",
      "value": "car",
      "match_type": "exact",
      "confidence": 1.0
    }
  ],
  "content_hash": "sha256:...",
  "analysis_version": "analysis-record-v1",
  "analysis_id": "analysis:logical:...",
  "analysis_result_id": "analysis-result:...",
  "index_id": "semantic-index:...",
  "index_version": "2026-08-25.1",
  "model": {
    "family": "semantic",
    "model_id": "example-local-embedder",
    "model_version": "1.0",
    "dimension": 768
  },
  "provenance": {
    "source_occurrences": [
      {
        "source_occurrence_id": "occurrence:sha256:...",
        "source_id": "source:sha256:...",
        "source_kind": "local_file",
        "source_location": "/approved/source/root",
        "original_path": "camera/IMG_001.jpg",
        "source_archive_id": null,
        "source_member": null
      }
    ]
  },
  "components": [
    {
      "retrieval_mode": "semantic",
      "relationship_type": "semantically_related",
      "raw_score": 0.82,
      "score_kind": "cosine_similarity",
      "normalized_score": 0.74,
      "weight": 0.7,
      "model": {
        "family": "semantic",
        "model_id": "example-local-embedder",
        "model_version": "1.0",
        "dimension": 768
      },
      "index_id": "semantic-index:...",
      "index_version": "2026-08-25.1"
    },
    {
      "retrieval_mode": "metadata",
      "relationship_type": "metadata_match",
      "raw_score": 1.0,
      "score_kind": "boolean_filter_match",
      "normalized_score": 1.0,
      "weight": 0.3,
      "model": null,
      "index_id": "metadata-index:...",
      "index_version": "2026-08-25.1"
    }
  ],
  "ranking": {
    "ranker": "weighted_sum",
    "final_score": 0.818,
    "component_formula": "sum(component.normalized_score * component.weight)",
    "notes": "Raw scores were normalized within their own component family before weighting."
  },
  "explanation": {
    "deterministic": false,
    "summary": "Matched semantic embedding input derived from tags and summary."
  }
}
```

Required fields:

- `asset_id`
- `retrieval_mode`
- `relationship_type`
- `content_hash`

Required when applicable:

- `score`
- `score_kind`
- `matched_fields`
- `analysis_version`
- `analysis_id`
- `analysis_result_id`
- `index_id`
- `index_version`
- `model`
- `provenance`
- `components`
- `ranking`
- `explanation`

Provider internals such as FAISS IDs, HNSW labels, database row numbers, raw vector payloads, and build-agent response objects must not be exposed as public result identity.

### Provenance Association

Search must preserve source occurrence relationships structurally. If provenance is returned inline, use `source_occurrences[]` objects that keep `source_occurrence_id`, `source_id` or another approved source reference, `original_path`, and approved archive/member fields together. A path must never be returned in an array detached from the occurrence it came from.

Search may alternatively return only `source_occurrence_id` values and require callers to resolve them with an approved provenance lookup. It must not return parallel arrays such as `source_occurrence_ids[]` and `original_paths[]`.

### Hybrid Component Contract

Hybrid results must expose a provider-independent `components[]` list when more than one retrieval contribution affects ranking. Each component records:

- `retrieval_mode`
- `relationship_type`
- model or index family
- raw score
- score kind
- normalized score where applicable
- component weight where applicable
- model ID/version and dimension where applicable
- `index_id`
- `index_version`

The result must also expose `ranking` metadata describing the final rank/score calculation. Implementations may use reciprocal rank fusion, weighted normalized score, learned rankers, or another approved strategy, but the strategy must be named and auditable. Raw scores from incompatible visual, semantic, or metadata families must not be directly compared without family-local normalization.

## Relationship Terminology

| Term | Meaning | Required proof |
|---|---|---|
| `exact_duplicate` | Same exact bytes and same canonical `asset_id` | Matching SHA-256 content hash |
| `same_asset_occurrence` | Same canonical asset observed in another source/path/archive member | Same `asset_id`, distinct source occurrence |
| `near_duplicate_candidate` | Looks like a duplicate but bytes differ or proof is incomplete | Compatible visual similarity result |
| `visually_similar` | Similar appearance, scene, object, or composition | Compatible visual similarity result |
| `semantically_related` | Text/analysis concepts are related | Semantic or hybrid result |
| `metadata_match` | Deterministic field/filter match | Indexed canonical metadata or normalized analysis |

Search and Ollama must not claim visually similar files are exact duplicates.

## Visual Index Versioning

Visual indexes are derived and rebuildable. Each visual feature/index family must track:

- `feature_model_id`
- `feature_model_version`
- `feature_family`
- vector `dimension`
- vector distance/similarity metric
- source `asset_id`
- `content_hash`
- exact analysis `result_id` where the feature/index consumed a historical terminal Analysis outcome
- logical `analysis_id` where useful for grouping/rebuild decisions
- `expected_content_hash`, verified `input_content_hash`, and diagnostic `observed_content_hash` semantics from the Analysis contract where applicable
- mandatory `feature_extractor_revision`
- similarity family and normalization semantics
- `index_id`
- `index_version`
- indexed-at timestamp
- stale/rebuild reason when applicable

Search must reject or isolate incompatible vector families, including dimension mismatches, model/version mismatches, incompatible metrics, and indexes built from superseded feature inputs.

Reindexing must rebuild derived state from canonical asset records and approved analysis outputs. It must not require the build agent that created the first index.

Canonical asset content is immutable. If a source path later contains different bytes, ingest creates a different SHA-256 and therefore a different canonical `asset_id`. The old asset's valid vector must not be invalidated merely because a source path changed. The new canonical asset lacks a vector until indexed.

Visual vector staleness is about mutable derived inputs, such as:

- exact Analysis `result_id` or logical `analysis_id`, depending on whether the stale check is about a terminal payload or logical profile revision;
- feature model/version;
- feature extraction input revision, including mandatory `feature_extractor_revision`;
- similarity family or normalization semantics;
- index version;
- unsupported or superseded feature family.

## Semantic Embedding Versioning

Semantic embeddings must track:

- embedding model ID/version
- embedding family
- vector dimension
- distance/similarity metric
- exact source text or input revision hash
- exact Analysis `result_id` when indexed text came from a persisted terminal Analysis outcome
- logical `analysis_id` where useful for rebuild grouping
- included input fields
- language/normalization settings where relevant
- source `asset_id`
- source `content_hash`
- Analysis `result_id` used, and `analysis_id` where available
- `index_id`
- `index_version`
- stale/rebuild reason

Semantic text inputs may include summaries, tags, OCR, source metadata, and approved user annotations. They must not include secrets, raw private paths beyond approved provenance fields, or hosted web content as if it were local asset truth.

Ollama may supply semantic embeddings if an approved local embedding model is selected, but Search still owns index state and result contracts.

## Query Operations

Project-facing Search operations should be stable even if internal index technology changes:

- `search_metadata(query, filters, limit, cursor)`
- `search_semantic(text, filters, limit, embedding_profile)`
- `find_visually_similar(asset_id, limit, feature_profile)`
- `search_hybrid(text, filters, visual_seed_asset_id, limit, profiles)`
- `get_search_state(asset_id)`
- `get_index_status(index_kind)`
- `explain_result(result_id_or_payload)`

These names are contract guidance, not final implementation signatures. The behavior and result shape are mandatory; implementation details remain with the Search owner.

`find_visually_similar(asset_id, ...)` must exclude the seed asset itself by default. A caller may opt in to self-return only with an explicit option such as `include_seed=true`, for diagnostics or index validation.

Paginated operations use a provider-independent envelope:

```json
{
  "results": [],
  "next_cursor": null
}
```

`next_cursor` is nullable. Clients pass a non-null cursor back to the same operation to retrieve the next page and must not depend on implementation-specific response shapes.

## Availability Rules

- Metadata retrieval works without Ollama.
- Visual similarity returns a typed unavailable/stale response when visual features or visual indexes are missing.
- Semantic retrieval returns a typed unavailable/stale response when semantic embeddings or indexes are missing.
- Search must distinguish no-match from index-unavailable.
- Search must not silently call Manus, ChatGPT, Codex Cloud, Gemini, or a hosted vector/search service unless an explicit architecture decision approves that provider as a runtime dependency.

## Prohibited Runtime Paths

- Gallery -> Manus
- Search -> Manus
- Ollama -> Manus
- Gallery -> ChatGPT Work
- Search -> Codex Cloud
- Search identity -> vector row number
- exact duplicate decision -> visual similarity score alone

## Open Contract Dependencies

Search consumes the merged Visual Analysis and Visual Feature contracts. Search/index records that need exact historical Analysis provenance MUST store the exact Analysis `result_id` and SHOULD also store the logical `analysis_id`. Visual compatibility MUST include the VisualFeature compatibility key: feature type, model ID/version, mandatory `feature_extractor_revision`, dimensions, similarity family, and normalization semantics.
