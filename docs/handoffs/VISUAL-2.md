# Visual 2 Search Builder handoff

## Scope completed

This branch implements the permanent **visual similarity** capability inside `services/search`. It accepts portable visual feature vectors tied to canonical `asset_id` values, persists derived local index state, returns ranked related canonical assets, and exposes explicit indexed/stale/missing state. It does not modify Analysis, Ingest, Asset Schema, Gallery, Assist, or Ollama.

Search uses the accepted ingest identity rule: `asset_id` and `content_hash` must both be the same canonical `sha256:<lowercase digest>` value. Visual results return only `near_duplicate_candidate` or `visually_similar`; they never infer `exact_duplicate` from a score. Exact byte identity remains an Ingest/content-hash responsibility.

## Files changed

| Path | Purpose |
|---|---|
| `services/search/pyproject.toml` | Local Python package, NumPy runtime dependency, test tooling, and local operator entry point. |
| `services/search/src/search_service/models.py` | Provider-independent visual feature, profile, result, availability, and health contracts. |
| `services/search/src/search_service/store.py` | Persistent SQLite WAL store with transactional upsert/removal, stale marking, profile isolation, and integrity rebuild. |
| `services/search/src/search_service/service.py` | Stable Search interface with cosine similarity retrieval and rebuild operations. |
| `services/search/src/search_service/cli.py` | Local `health` and profile `status` inspection commands. |
| `services/search/tests/` | Contract, persistence, stale, corruption, isolation, result-shape, and prohibited-runtime-dependency tests. |
| `services/search/scripts/benchmark_visual_index.py` | Deterministic fixture benchmark harness for 1k/10k/100k local index measurements. |
| `services/search/README.md` | Runtime contract, deployment, backup/recovery, model upgrade, adapter, and evaluation notes. |
| `docs/handoffs/VISUAL-2.md` | This handoff. |

## Design and permanent dependencies

The implementation selects **SQLite plus NumPy**. SQLite stores versioned, rebuildable vector metadata and float32 payloads locally with WAL mode and full synchronous commits. NumPy supplies exact cosine ranking over a process-local normalised matrix cache. The durable store is keyed by a deterministic profile partition comprising feature family, model identifier, model version, dimension, and metric; incompatible vectors cannot be queried together.

The sole additional runtime package is `numpy`. SQLite is part of Python’s standard library. There is no hosted vector database, model SDK, external search endpoint, credential, build-worker API, or worker-specific runtime identity.

## Stable Search interface

`VisualSearchService` offers these operations:

| Operation | Outcome |
|---|---|
| `index_visual_feature()` | Idempotent, version-partitioned feature upsert. |
| `remove_asset()` | Removes derived vectors while leaving canonical records untouched. |
| `invalidate_asset()` | Marks a vector stale with an explicit reindex reason. |
| `find_visually_similar()` | Ranked compatible neighbours from a canonical seed asset. |
| `find_similar_vector()` | Ranked compatible neighbours from an authorised query vector. |
| `get_search_state()` | Typed `indexed`, `stale`, or `missing` state. |
| `get_index_status()` / `health()` | Index health, vector counts, profile, version, and storage location. |
| `rebuild_index()` | Validates stored vector payloads and rebuilds process-local state. |
| `rebuild_from_features()` | Atomically replaces a whole derived profile from authorised Analysis outputs. |

The result shape intentionally matches the concurrent Search contract direction: canonical `asset_id`, canonical `content_hash`, `score`, `score_kind`, `retrieval_mode`, `relationship_type`, index ID/version, model metadata, analysis provenance where supplied, and a plain explanation. SQLite rows, vectors, and partition keys are not exposed.

## Verification completed

The local verification commands completed successfully on 2026-08-25:

```bash
python -m pip install -e packages/asset-schema -e 'services/search[test]'
ruff check services/search/src services/search/tests services/search/scripts
mypy services/search/src
python3 -m compileall -q services/search/src services/search/scripts
pytest services/search/tests
ollamabinsaden-search --database /tmp/ollamabinsaden-search-health.sqlite3 health
git diff --check
```

The test suite reports **12 passing tests**. It covers nearest neighbour order, canonical ID-only results, self-result exclusion, explicit near-duplicate terminology, profile/model isolation, dimension validation, idempotent upsert, removal, filters, restart persistence, stale-vector handling, full replacement rebuild, intentionally empty rebuild, malformed input rejection, corrupt vector isolation, public result encapsulation, and a static scan of production source for accidental build-worker runtime dependencies.

The fresh-database CLI check returned a ready Search service with an empty visual profile list, confirming the local operator path can initialise persistent state without an index or external dependency.

## Fixture benchmark results

The deterministic evaluation harness was executed with 64-dimensional vectors and 20 queries at each scale. These values are implementation-baseline measurements, not production VM acceptance evidence.

| Vectors | Indexing rate | Mean query latency | SQLite database size | Peak process memory |
|---:|---:|---:|---:|---:|
| 1,000 | 48,323 vectors/s | 0.366 ms | 1.02 MB | 41.7 MB |
| 10,000 | 47,287 vectors/s | 7.576 ms | 9.85 MB | 82.5 MB |
| 100,000 | 38,579 vectors/s | 211.989 ms | 98.1 MB | 490.3 MB |

The 100k fixture result shows the expected cost of full exact cosine ranking and Python fixture preparation. It does not justify distributed infrastructure. It establishes a clear future decision point: validate real Analysis embeddings and real VM latency/memory budgets before replacing only the internal ranking implementation with a self-hosted approximate index.

## Review correction: empty and degraded state semantics

The approved follow-up review corrected profile status semantics without changing the SQLite-plus-NumPy architecture. `rebuild_from_features(profile, [])` now deliberately clears active and stale derived rows, returns `IndexStatus(state="empty")`, and does not build a query cache or raise merely because zero vectors remain. A profile is `ready` only when it has active vectors and no stale vectors; it is `empty` only when it has neither active nor stale vectors; and it is `degraded` whenever stale or corrupt vectors require reindexing.

`health()` now keeps process availability separate from index health. `service_status: ready` reports an operational Search process, while `index_status: degraded` reports that at least one persisted profile requires reindexing. The empty-rebuild and corrupt-vector regression tests verify these outcomes.

## Persistence and recovery

The vector database is derived state. The canonical asset records plus accepted Analysis records remain authoritative. Operators should place SQLite state under the persistent VM state root, back up the database using a database-aware process or checkpointed copy including WAL/SHM sidecars, and rebuild from authorised feature outputs if corruption occurs.

A model upgrade creates a new `FeatureProfile`; it does not mix vectors with earlier models or dimensions. The new profile is indexed, quality-checked, and explicitly selected by callers before the old derived profile is retired.

## Integration contract and known limitations

The concurrent `work/search-ollama-contract` branch provides a useful Search result and query-contract direction, but was not merged into this branch or modified. This implementation remains compatible with its stated canonical-identity, profile-versioning, relationship, availability, and encapsulation requirements. The concurrent Analysis branch’s portable `VisualFeature` is treated as a design input only; `services/search` does not import or depend on its private implementation.

The following items are intentionally deferred to their owners or future approved work:

1. Analysis-to-Search adapter wiring after the Analysis feature contract is accepted.
2. Gallery transport and similar-items UI integration; `apps/gallery` was not modified because it has a concurrent owner.
3. Semantic/hybrid retrieval and Ollama query orchestration.
4. HTTP or worker transport; the public Python interface and CLI are local-only foundations.
5. Real archive, real visual-analysis embedding, VM deployment, and end-to-end Gallery verification.
6. Any replacement of exact NumPy ranking with an approximate local index, contingent on measured real-data requirements and architecture approval.

## Recommended next owner

An architecture/schema reviewer should first reconcile this package with the accepted Analysis and Search contract branches. After that, the Analysis/Search integration owner can implement the small explicit adapter that maps approved Analysis features into `VisualFeatureInput`, followed by the Gallery owner consuming the result/state interface.

## Final merged-contract reconciliation

PR #11 was reconciled against merged VisualFeature and Search contracts after incorporating `origin/main` at `af5ee582fa806d583defb9893405ecb286c9290c`. The accepted normalized input now requires `feature_type`, `feature_model_id`, `feature_model_version`, mandatory `feature_extractor_revision`, `dimensions`, `similarity_family`, and explicit normalization semantics. Every component participates in the profile partition key, so compatible model weights alone cannot mix extraction/preprocessing revisions.

Each indexed vector now persists optional logical `analysis_id` and exact terminal `analysis_result_id`, and visual result payloads expose those values when present. The local SQLite schema was advanced to v2; because index rows are derived and rebuildable, opening an obsolete v1 database discards its old derived profile/vector tables and requires reindexing from authorised feature records rather than guessing incomplete compatibility or provenance fields.

This reconciliation deliberately does not implement an executable Analysis-to-Search adapter. That integration remains gated on the accepted concrete Analysis runtime. The local SQLite WAL persistence, NumPy exact cosine retrieval, canonical asset identity, empty/degraded status handling, and process/index health distinction are preserved.

## Five-finding corrective pass

After incorporating `origin/main` at `ae712546eee541cb4039dc25e5f5a3f81b6029b4`, PR #11 was corrected without changing the accepted visual-similarity architecture. Search now declares Python `>=3.12`, matching the accepted runtime baseline and its existing use of Python 3.11+ standard-library typing/time APIs. Calculated finite cosine scores are clamped to the mathematical interval before relationship classification and strict result validation; non-finite inputs and scores still fail closed.

Process-local vector snapshots now carry the durable profile `index_version`. Before reuse, a service compares that version with SQLite state and rebuilds only the affected profile snapshot when another service instance has indexed, removed, invalidated, or rebuilt it. SQLite parent-directory failures are translated into `IndexUnavailableError` with the underlying filesystem exception retained as the cause. The existing empty-rebuild behaviour remains unchanged and verified: an authorised empty replacement clears the profile and returns `empty` without a cache-warmup error.

The correction suite includes Python metadata, upper-score clamping, non-finite rejection, shared-database insert/remove/invalidate visibility, and directory-failure translation, alongside the previous identity, compatibility, provenance, restart, empty/degraded, and provider-independence checks. The full Analysis-to-Search adapter remains explicitly out of scope pending an independent integration assignment.
