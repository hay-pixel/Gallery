# Search Service

`services/search` is the permanent retrieval boundary for **deterministic metadata**, **visual similarity**, and later **semantic retrieval**. This implementation delivers the visual-similarity portion of that boundary. It accepts provider-independent visual feature vectors associated with canonical `asset_id` values, stores derived local index state durably, and returns ranked canonical asset IDs.

> **Identity rule:** A visual result is related content, not proof of byte identity. Exact duplicate identity remains the ingest/content-hash concern: the same exact SHA-256 bytes map to the same canonical `asset_id`.

## Runtime boundary

The service is deliberately independent of any temporary build worker, hosted vector database, browser application, or model SDK. The future analysis runtime supplies normalised visual features; Search owns their durable indexing and retrieval; Gallery and Ollama consume stable result objects rather than SQLite rows, raw vectors, or implementation-specific index handles.

| Responsibility | Owner | This implementation does |
|---|---|---|
| Canonical asset identity and content hash | Ingest and `asset-schema` | Validates that `asset_id` and `content_hash` are canonical SHA-256 identities for the same bytes. |
| Visual feature extraction | Analysis | Accepts portable model/version/dimension/vector metadata without importing an analysis backend. |
| Visual vector persistence, isolation and ranking | Search | Persists profile-partitioned vectors, provides cosine nearest-neighbour ranking, handles stale/removal/rebuild state. |
| Exact duplicates | Ingest/content identity | Remains outside visual score logic. |
| Similar-items UI and semantic reasoning | Gallery and Ollama | Deferred to their owners; this package exposes their stable Search-facing inputs and results. |

## Chosen technology

The first implementation uses **SQLite** for durable derived state and **NumPy** for exact in-process cosine ranking. SQLite provides a portable, transactional, self-hosted database already suited to a single VM. NumPy avoids introducing a hosted or provider-specific search dependency and gives predictable ranking across the complete compatible profile. The public Search interface deliberately does not expose either implementation detail, allowing a future measured migration to a local ANN engine such as HNSW without changing callers.

| Layer | Implementation | Reason |
|---|---|---|
| Durable metadata and vector payloads | SQLite in WAL mode with full synchronous commits | Process-restart persistence, transactional upsert/removal, simple backup, and no external service. |
| Vector profile isolation | One SQLite partition key per feature family, model ID, version, dimension, and metric | Incompatible vectors cannot be mixed accidentally. |
| Ranking | Exact cosine similarity with NumPy | Deterministic baseline that is straightforward to evaluate before adding an approximate index. |
| Acceleration | Rebuildable in-process normalised matrix cache | Reduces repeated query work while leaving SQLite as durable state. |

## Public Python interface

The stable public API is `search_service.VisualSearchService`. Its contracts are provider-independent and use canonical identifiers only.

```python
from search_service import FeatureProfile, VisualFeatureInput, VisualSearchService

profile = FeatureProfile(
    feature_family="visual-embedding",
    model_id="local-vision-model",
    model_version="1.0.0",
    dimension=768,
)

with VisualSearchService("/srv/sorter/state/search/visual-index.sqlite3") as search:
    search.index_visual_feature(
        VisualFeatureInput(
            asset_id="sha256:<64 lowercase hex characters>",
            content_hash="sha256:<the same 64 lowercase hex characters>",
            profile=profile,
            values=[...],
            feature_id="analysis-feature-id",
            analysis_version="analysis-record-v1",
            analysis_revision="analysis:sha256:...",
        )
    )
    results = search.find_visually_similar(
        "sha256:<seed asset digest>", profile, limit=20
    )
```

| Operation | Behaviour |
|---|---|
| `index_visual_feature(feature)` | Idempotently upserts one provider-independent visual vector into a compatible model/version partition. |
| `remove_asset(asset_id, profile=None)` | Deletes derived visual vectors for an asset without touching canonical asset data. |
| `invalidate_asset(asset_id, profile, reason)` | Marks an existing vector stale and excludes it from similarity retrieval until it is reindexed. |
| `find_visually_similar(asset_id, profile, limit, filters)` | Uses the seed asset’s compatible active vector to return ranked related canonical asset IDs. |
| `find_similar_vector(values, profile, limit, filters)` | Queries an authorised compatible visual vector directly. |
| `get_search_state(asset_id, profile)` | Returns the typed `indexed`, `stale`, or `missing` state rather than treating it as a no-result. |
| `get_index_status(profile)` and `health()` | Return profile counts, version, storage path, and local index health. |
| `rebuild_index(profile)` | Validates persisted vector rows and rebuilds the process-local query cache. |
| `rebuild_from_features(profile, features)` | Atomically replaces one derived profile from authorised canonical Analysis outputs. |

Visual results use the project Search result shape: `asset_id`, `content_hash`, `score`, `score_kind`, `retrieval_mode`, `relationship_type`, `index_id`, `index_version`, and portable feature-model metadata. The only relationships issued by this visual service are `visually_similar` and, when an evaluator-configured threshold is supplied, `near_duplicate_candidate`.

## Status semantics

`health()` separates the running Search process from the state of each persisted visual profile. `service_status: ready` means the local process can inspect its database; it does not claim that every profile is searchable. `index_status` is `degraded` when any profile requires reindexing, otherwise `ready`.

| Profile state | Meaning |
|---|---|
| `empty` | The profile has no active vectors and no stale vectors. An intentional `rebuild_from_features(profile, [])` clears a profile and returns this state without raising. |
| `ready` | The profile has one or more active vectors and no stale vectors. |
| `degraded` | One or more stale or corrupt vectors require reindexing. Remaining active vectors are still retained, while stale vectors remain excluded from retrieval. |

## Gate 4: executable Analysis VisualFeature bridge

Analysis does not call Search internals and production Search does not import `analysis_service`. The executable boundary is serialized project-owned data:

```text
Analysis VisualFeature.to_dict()
  -> search_service.analysis_adapter.visual_feature_input_from_analysis()
  -> validated VisualFeatureInput
  -> persistent visual index
```

The adapter maps Analysis `schema`, `schema_version`, `feature_id`, canonical asset/hash, full feature compatibility key, inline values, generated timestamp, logical `analysis_id`, and exact upstream `result_id` to Search `analysis_result_id` unchanged. It requires non-empty Analysis profile ID/version and `scope: whole_image` for image-v1.

Use `ollamabinsaden-search --database ./data/search/visual-index.sqlite3 index-analysis-feature --feature-json ./feature.json`, or pass `-` for stdin. The output reports canonical asset/feature/Analysis IDs, index identity/version, and whether durable state changed without exposing raw vectors or SQLite row identities.

Gate 4 accepts only inline vector payloads. An external `storage_reference` without `values` is rejected with a typed contract error because external blob decoding and lifecycle ownership remain future Search work. This bridge is not full Search: metadata, semantic, hybrid, pagination, HTTP/API, Ollama, and Gallery integration remain out of scope.

## Persistence, backup and recovery

The SQLite database is **derived state**. Canonical asset records and accepted Analysis outputs remain the source of truth for rebuilding it.

| Concern | Design and operator action |
|---|---|
| Database location | Choose a persistent VM state path, for example `$SORTER_STATE_ROOT/search/visual-index.sqlite3`; do not use temporary extraction directories. |
| Restart | SQLite vector/profile state is loaded on process start; the in-process ranking matrix is reconstructed lazily. |
| Backup | Include the SQLite database and its WAL/SHM sidecars in a consistent database-aware backup, or checkpoint SQLite before copying. Backups are helpful for fast restore but are not the only recovery path. |
| Corruption | Stop the service, retain the corrupt database for diagnosis, create a fresh database, then call `rebuild_from_features()` using canonical Analysis outputs. |
| Stale vector | Call `invalidate_asset()` with an explicit reason; it will not participate in searches until Analysis emits a replacement feature. |
| Model upgrade | Create a new `FeatureProfile` for the new model/version/dimension, index it separately, validate quality, update callers to request it, then retire the old derived partition when approved. |
| Full rebuild | Enumerate canonical ready asset records and accepted Analysis visual features, then call `rebuild_from_features(profile, features)` per compatible profile. |

## Local installation and operator checks

This service has only local Python dependencies. It does not require a hosted vector store, an external inference account, or a build-worker credential.

```bash
python -m pip install -e packages/asset-schema -e 'services/search[test]'
pytest services/search/tests
ollamabinsaden-search --database "$SORTER_STATE_ROOT/search/visual-index.sqlite3" health
```

The CLI is intentionally limited to local state inspection and typed serialized Analysis feature indexing. It is not a public service endpoint. A future VM deployment unit should bind any service adapter to the private network and supply the database path through environment/configuration without placing secrets in the repository.

## Evaluation and performance

Use the deterministic fixture harness before choosing a more complex index engine:

```bash
python services/search/scripts/benchmark_visual_index.py \
  --output-dir /tmp/ollamabinsaden-search-benchmark \
  --scales 1000 10000 100000 \
  --dimension 64 \
  --json-output /tmp/ollamabinsaden-search-benchmark/results.json
```

The harness measures fixture preparation, transactional indexing rate, mean repeated-query latency, SQLite database size, and process high-water memory. Its vectors are evaluation fixtures only; production acceptance must be repeated with approved visual-analysis features and real archive assets on the VM.

## Limitations and next integration steps

The current ranking engine performs exact cosine search inside each compatible profile. This is intentional baseline behaviour, not a distributed-search claim. If VM benchmarks on representative real embeddings show that exact ranking fails the required latency or memory budget, retain the public contract and replace only the internal ranking implementation after architecture review.

Gallery integration is intentionally not included in this branch because `apps/gallery` is concurrently owned. The Gallery owner can consume the `SimilarityResult.to_dict()` shape and typed unavailable/stale states through a stable Search adapter. Semantic retrieval, hybrid ranking, HTTP transport, model selection, and source-occurrence provenance enrichment remain separate follow-on work.
