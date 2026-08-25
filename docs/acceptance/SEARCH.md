# Search Acceptance

## Scope

These checks evaluate Search behavior and architecture. They do not prescribe the internal vector database, nearest-neighbour library, database engine, or ranking algorithm.

## Architecture Gate

Search is acceptable only if:

- every result maps to canonical `asset_id`;
- exact duplicates are decided by SHA-256 byte identity, not visual scores;
- metadata, visual similarity, and semantic retrieval are distinct modes;
- visual and semantic vector families are versioned and isolated;
- indexes are derived/rebuildable state;
- Search works without Ollama for deterministic operations;
- Search has no production dependency on Manus, ChatGPT Work, Codex Cloud, Gemini, or build-session IDs.

## Evaluation Matrix

| Case | Fixture shape | Expected behavior | Metrics |
|---|---|---|---|
| exact filename match | assets with distinct original paths | returns matching `asset_id` and matched `original_path` | precision@10, latency |
| tag/category search | analysis tags include `car`, `receipt`, `beach` | returns assets with matching normalized tags | precision@k, recall@k |
| OCR text search | OCR text includes fuel receipt text | returns OCR-matching assets with matched field | precision@k, MRR |
| same-source filtering | multiple source occurrences | filters by source kind/location without losing asset identity | precision@k |
| exact duplicate | two occurrences of same bytes | one `asset_id`, multiple source occurrences | identity correctness |
| visual near duplicate | same photo resized/cropped/recompressed | returns candidate as `near_duplicate_candidate`, not exact duplicate | recall@k, MRR |
| visually similar scene | different beach/car/night photos | ranks same-scene assets ahead of unrelated assets | precision@k, MRR |
| semantic concept match | text query over summaries/tags/OCR | returns conceptually relevant assets | precision@k, recall@k, MRR |
| ambiguous query | query like `jaguar` | returns candidates with uncertainty or asks for clarification through query layer | precision@k, explanation quality |
| no-match query | nonexistent concept/source | returns no results without hallucinated assets | false positive rate |
| incompatible model family | visual vector queried against semantic family, or incompatible visual family | rejects mixing or isolates indexes | safety correctness |
| incompatible dimension | vector dimension differs from index dimension | rejects query/index use with typed error | safety correctness |
| incompatible version | model or index version differs from compatible family | rejects mixing or requires matching index | safety correctness |
| stale derived input/index | exact Analysis `result_id`, logical `analysis_id`, feature extractor revision, feature model/version, semantic input revision, embedding model/version, or index version is superseded | marks stale or rebuilds derived state before use | stale detection |
| unavailable index | requested metadata/visual/semantic index is missing or offline | returns typed unavailable state, not no-match | unavailable classification |

## Required Metrics

Track at minimum:

- precision@k for `k = 5, 10`, plus `k = 50` where fixture size supports it;
- recall@k for supported labelled relevant sets using the same supported `k` values as precision;
- MRR for ranked known-item queries;
- latency p50/p95 by retrieval mode;
- index size by mode;
- memory use during index build and query;
- stale-index detection count;
- unavailable/error classifications.

Thresholds must be set after representative fixtures exist. A few attractive demos are not enough.

## Result Contract Checks

For every retrieval mode:

- `asset_id` is present and canonical.
- `retrieval_mode` is present.
- `relationship_type` is present.
- `content_hash` is present.
- deterministic matches include `matched_fields`.
- vector results include model/index metadata, including `index_id` and `index_version`.
- Search/index records requiring exact historical Analysis provenance include Analysis `result_id` and should also include logical `analysis_id`.
- provider internals are not exposed as public IDs.
- score semantics are labelled and not compared across incompatible families.
- hybrid results include component retrieval contributions and final ranking metadata.

## Degradation Checks

- Metadata Search works when Ollama is offline.
- Visual Search reports unavailable when visual index is absent.
- Semantic Search reports unavailable when semantic index is absent.
- No-match and unavailable are distinguishable.
- Analysis pending/stale/failed states are visible to callers.

## VISUAL-2-SEARCH-BUILDER Review Checklist

Use this durable capability checklist when reviewing the Visual Search implementation PR, regardless of whether Manus, Codex, Gemini, ChatGPT, or a human performed the build role:

- Results are keyed by canonical `asset_id`.
- Same SHA-256 bytes are exact duplicates; visual similarity is separate.
- Index state can be rebuilt from canonical assets and analysis/features.
- Visual feature records include model ID/version, dimension, content hash, mandatory `feature_extractor_revision`, similarity family, normalization semantics, exact Analysis `result_id` where used, and index ID/version.
- Incompatible vector families cannot be mixed silently, including mismatched feature type, model ID/version, extractor revision, dimension, similarity family, or normalization semantics.
- Missing/stale vectors produce typed states.
- No Manus API, Manus credential, Manus-hosted vector service, or Manus response shape is required at runtime.
- Gallery-facing APIs are provider-independent.
- Latency and memory are measured on representative fixture size.
- Tests cover exact duplicate, near duplicate candidate, similar scene, no-match, stale vector, and unavailable index.
