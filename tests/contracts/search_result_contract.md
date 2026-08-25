# Search Result Contract Fixture Specification

This file defines contract fixture expectations for future automated tests.

## Minimal Metadata Result

```json
{
  "asset_id": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "content_hash": "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "retrieval_mode": "metadata",
  "relationship_type": "metadata_match",
  "matched_fields": [
    {
      "field": "mime_type",
      "value": "image/jpeg",
      "match_type": "exact",
      "confidence": 1.0
    }
  ],
  "provenance": {
    "source_occurrences": [
      {
        "source_occurrence_id": "occurrence:sha256:1111111111111111111111111111111111111111111111111111111111111111",
        "source_id": "source:sha256:2222222222222222222222222222222222222222222222222222222222222222",
        "original_path": "camera/IMG_001.jpg"
      }
    ]
  }
}
```

Acceptance:

- `asset_id` and `content_hash` use algorithm-qualified SHA-256.
- no filename, path, vector row, or provider ID is used as identity.
- deterministic explanation comes through `matched_fields`.
- provenance keeps each `original_path` attached to its `source_occurrence_id`.

## Minimal Visual Similarity Result

```json
{
  "asset_id": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "content_hash": "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
  "retrieval_mode": "visual_similarity",
  "relationship_type": "near_duplicate_candidate",
  "score": 0.91,
  "score_kind": "cosine_similarity",
  "model": {
    "family": "visual",
    "model_id": "approved-visual-feature-model",
    "model_version": "1.0",
    "dimension": 512,
    "feature_extractor_revision": "extractor-rev-1",
    "similarity_family": "cosine",
    "normalization": {"kind": "l2", "applied": true}
  },
  "analysis_id": "analysis:logical:visual-example",
  "analysis_result_id": "analysis-result:visual-terminal-example",
  "index_id": "visual-index:approved-visual-feature-model:1.0",
  "index_version": "visual-index-v1"
}
```

Acceptance:

- relationship is not `exact_duplicate` unless SHA-256 identity proves it.
- model and index metadata are present, including both `index_id` and `index_version`.
- visual compatibility metadata includes mandatory `feature_extractor_revision`, similarity family, and normalization semantics.
- exact Analysis terminal provenance uses `analysis_result_id`, with logical `analysis_id` alongside it.
- vector-library internal IDs are absent.
- seed asset self-return is excluded unless explicitly requested by the caller.

## Minimal Semantic Result

```json
{
  "asset_id": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "content_hash": "sha256:cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
  "retrieval_mode": "semantic",
  "relationship_type": "semantically_related",
  "score": 0.77,
  "score_kind": "cosine_similarity",
  "model": {
    "family": "semantic",
    "model_id": "approved-local-text-embedder",
    "model_version": "1.0",
    "dimension": 768
  },
  "index_id": "semantic-index:approved-local-text-embedder:1.0",
  "index_version": "semantic-index-v1",
  "analysis_id": "analysis:logical:semantic-example",
  "analysis_result_id": "analysis-result:semantic-terminal-example",
  "semantic_input_revision": "semantic-input:summary-tags-ocr:v1"
}
```

Acceptance:

- semantic model metadata is separate from visual model metadata.
- exact Analysis terminal provenance is traceable through `analysis_result_id`, with logical `analysis_id` alongside it.
- both `index_id` and `index_version` are present.

## Minimal Hybrid Result

```json
{
  "asset_id": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  "content_hash": "sha256:dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
  "retrieval_mode": "hybrid",
  "relationship_type": "semantically_related",
  "score": 0.86,
  "score_kind": "weighted_normalized_score",
  "components": [
    {
      "retrieval_mode": "semantic",
      "raw_score": 0.74,
      "score_kind": "cosine_similarity",
      "normalized_score": 0.8,
      "weight": 0.7,
      "model": {
        "family": "semantic",
        "model_id": "approved-local-text-embedder",
        "model_version": "1.0",
        "dimension": 768
      },
      "analysis_id": "analysis:logical:hybrid-semantic-example",
      "analysis_result_id": "analysis-result:hybrid-semantic-terminal-example",
      "index_id": "semantic-index:approved-local-text-embedder:1.0",
      "index_version": "semantic-index-v1"
    },
    {
      "retrieval_mode": "metadata",
      "raw_score": 1.0,
      "score_kind": "boolean_filter_match",
      "normalized_score": 1.0,
      "weight": 0.3,
      "model": null,
      "index_id": "metadata-index:v1",
      "index_version": "metadata-index-v1"
    }
  ],
  "ranking": {
    "ranker": "weighted_sum",
    "final_score": 0.86,
    "component_formula": "sum(component.normalized_score * component.weight)"
  }
}
```

Acceptance:

- component scores include raw score, score kind, normalized score where applicable, model/version, Analysis provenance where applicable, `index_id`, and `index_version`.
- final score is explained by `ranking` metadata.
- incompatible raw visual and semantic scores are not directly compared.
