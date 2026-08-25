# Visual Feature Contract

## Purpose

This contract defines provider-independent derived visual features that Analysis may produce and Search may index for visual similarity. Search must be able to consume every conforming record without importing the Analysis implementation, knowing which build agent created it, or guessing how a model/runtime encoded its vector.

Visual features are rebuildable derived data. They never redefine canonical asset identity.

## VisualFeature v1

Required fields:

| Field | Type | Semantics |
|---|---|---|
| `schema` | string | `visual-feature` |
| `schema_version` | integer | Contract version, initially `1` |
| `feature_id` | string | Stable project-owned feature revision ID |
| `asset_id` | string | Canonical asset identity |
| `input_content_hash` | string | Verified exact bytes from which the feature was generated |
| `feature_type` | string | Logical feature family such as `image_embedding`, `frame_embedding`, or `video_embedding` |
| `feature_model_id` | string | Stable model/family identifier |
| `feature_model_version` | string | Specific model revision, serialized as a string |
| `feature_extractor_revision` | string | Mandatory project-owned revision of the complete material extraction/preprocessing pipeline |
| `dimensions` | integer | Positive vector dimensionality |
| `similarity_family` | string | Project-owned comparison family such as `cosine`, `dot_product`, or `euclidean` |
| `normalization` | object | Explicit persisted/comparison normalization semantics |
| `generated_at` | timestamp | UTC RFC 3339 generation time |
| `values` or `storage_reference` | array or string | At least one representation is required for a usable feature |

Optional provenance fields include:

- `analysis_id`: logical analysis identity associated with feature generation when applicable;
- `result_id`: exact persisted Analysis result used when historical provenance matters;
- `analysis_profile_id` / `analysis_profile_version`;
- `scope`: whole image, frame timestamp, temporal aggregate, or another explicitly defined scope.

External-storage descriptor fields become mandatory when `storage_reference` is present as described below.

## Mandatory extractor revision

`feature_extractor_revision` identifies the complete material feature-generation pipeline beyond model weights alone. It MUST be present on every feature and MUST change whenever a change can alter vector geometry, coordinate meaning, or comparison semantics, including changes to:

- image resize policy;
- crop policy;
- transforms/augmentation used at inference;
- tokenizer or token preparation where applicable;
- pooling;
- input preprocessing;
- feature postprocessing;
- normalization before persistence;
- channel/color-space handling when material;
- quantization or dequantization semantics when material;
- any other feature-generation step capable of changing the resulting vector space.

Two features MUST NOT be considered compatible merely because `feature_model_id` and `feature_model_version` match. Model weights plus a materially different extraction pipeline are a different compatibility family.

## Compatibility key

Vectors may be compared only when their declared compatibility key matches, unless a separately versioned and tested project-owned adapter explicitly converts between the two spaces.

The v1 compatibility key unconditionally includes:

```text
feature_type
feature_model_id
feature_model_version
feature_extractor_revision
dimensions
similarity_family
normalization semantics
```

`feature_extractor_revision` is never optional in the compatibility key.

Search MUST reject or isolate accidental mixing when any compatibility component differs. A matching dimensionality or model marketing name is not evidence of compatibility.

A material change to resize, crop, transforms, tokenizer, pooling, preprocessing, postprocessing, normalization, feature interpretation, or vector geometry MUST result in a changed `feature_extractor_revision`, even when the model weights/version are unchanged.

## Feature identity

`feature_id` should be deterministic over the compatibility identity plus:

- `asset_id`;
- `input_content_hash`;
- scope information when not whole-image;
- any Analysis/profile input revision that materially affects feature generation.

Retry time, host name, build-agent session, provider job ID, and temporary execution IDs must not define `feature_id`.

## Normalization

`normalization` is required because Search cannot safely infer comparison semantics from a model name.

Example:

```json
{
  "kind": "l2",
  "applied": true
}
```

Minimum semantics:

- `kind`: stable project-owned value such as `none` or `l2`;
- `applied`: boolean stating whether the persisted vector already has that normalization.

If comparison requires unit-normalized vectors, the record must state whether normalization has already been applied. Search must not silently mix normalized and unnormalized vectors.

Any material normalization-pipeline change must also bump `feature_extractor_revision`; the normalization object describes comparison state, while the extractor revision versions the complete pipeline that produced it.

## Value/storage representation

The contract permits inline values, a project-owned external representation, or both. Search must never need Analysis implementation knowledge to decode a conforming external payload.

### Inline values

```json
{
  "values": [0.012, -0.08, 0.31]
}
```

Rules:

- array length must equal `dimensions`;
- all values must be finite numeric values;
- JSON serialization must not emit NaN or Infinity;
- if quantized/non-default precision is used, its interpretation must be explicitly represented rather than guessed.

### External storage

When `storage_reference` is present, the external payload MUST be self-describing through normalized project-owned metadata. At minimum the record must include:

- `storage_reference`: project-controlled retrievable locator;
- `storage_format`: project-owned encoding/layout identifier, for example `raw-vector-v1`;
- `dtype`: numeric element type, for example `float32`;
- `byte_order`: `little`, `big`, or `not_applicable` as appropriate for the declared format/type;
- `dimensions`: the same required positive dimension declared by the feature;
- `checksum`: algorithm-qualified integrity checksum of the exact external payload bytes.

Example:

```json
{
  "storage_reference": "visual-features/sha256/.../feature.bin",
  "storage_format": "raw-vector-v1",
  "dtype": "float32",
  "byte_order": "little",
  "dimensions": 512,
  "checksum": "sha256:..."
}
```

Rules:

1. Search must be able to retrieve, decode, validate length/dimensions, and integrity-check the payload using the normalized record alone.
2. Consumers must not guess dtype, endianness, packing, compression, framing, or vendor-native serialization.
3. A vendor format may be supported only when wrapped by a stable project-owned `storage_format` definition that fully specifies decoding semantics. A vendor-specific format name by itself is not sufficient.
4. `checksum` covers the exact stored payload bytes addressed by `storage_reference`.
5. If both inline `values` and `storage_reference` are present, the external representation still requires the full descriptor above so either representation can be independently validated.
6. The reference must not be a temporary build-agent URL, session, or credential-bound locator.

Search must be able to rebuild the feature from canonical assets if the derived store is lost.

## Staleness and rebuildability

A feature is stale when any of the following is true:

- `input_content_hash` no longer matches the accepted canonical asset revision;
- its compatibility key is no longer the approved feature profile for current indexing;
- associated Analysis/profile input revision changed where that revision participates in feature generation;
- externally stored values fail checksum/integrity or decoding validation;
- `feature_extractor_revision` changed;
- the current approved feature family replaced the stored model/version or comparison semantics.

Features and indexes are derived state. Loss or replacement must be recoverable by rerunning the approved permanent analyser/feature extractor against canonical assets. Rebuild must not require Manus, ChatGPT, Codex, Gemini, or the build session that first created the feature.

## Model or extractor replacement

Replacing the feature model or materially changing the extractor pipeline:

- does not change `asset_id`;
- creates a new feature revision/compatibility family;
- may coexist with older feature generations during migration/evaluation;
- requires a new Search index or isolated index partition when the compatibility key changes;
- must not silently append incompatible vectors to an existing index.

## Search-facing requirements

Using only the normalized VisualFeature record, Search must be able to determine:

1. which canonical asset the vector belongs to;
2. which exact verified bytes produced it;
3. which feature type/model/version produced it;
4. which complete extractor/preprocessing revision produced it;
5. vector dimensions;
6. similarity/distance semantics;
7. normalization semantics;
8. whether the vector is compatible with an index/query vector;
9. whether it is stale;
10. how to retrieve and decode values;
11. how to integrity-check external values;
12. which exact Analysis result supplied provenance when `result_id` is recorded;
13. which derived index needs rebuilding when feature compatibility identity changes.

Search does not need to import Analysis model classes, inference libraries, Torch/TensorFlow/ONNX code, provider SDKs, or provider-native vector-store readers.

## Image/video scope

Image v1 normally uses `feature_type: image_embedding` and whole-image scope.

Future video-derived features must distinguish at least:

- `frame_embedding`: parent `asset_id`, parent hash, timestamp/sampling identity;
- `video_embedding`: whole-video/temporal aggregate;
- optional `region_embedding` if later approved.

Search must not mix image, frame, region, and video feature families solely because dimensions happen to match. Compatibility must be explicit.

## Exact duplicate boundary

VisualFeature similarity must never be used as proof of exact duplication. Exact duplicate proof remains canonical SHA-256 byte identity.

A high visual score may support `near_duplicate_candidate` or `visually_similar`, not `exact_duplicate` unless canonical content hash also matches.

## Provider/build-agent independence

Forbidden production requirements include:

- Manus vector IDs or Manus-hosted feature stores required for retrieval;
- ChatGPT/OpenAI embedding APIs merely because this contract was authored in ChatGPT;
- Codex runtime/task IDs;
- proprietary temporary-worker response formats;
- opaque vendor IDs as the only compatibility/version/storage signal.

Runtime/model provenance is allowed in normalized model/version fields. The vector must remain usable or rebuildable after the temporary build worker disappears.
