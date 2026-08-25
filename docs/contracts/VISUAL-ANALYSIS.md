# Visual Analysis Contract

## Purpose

This document defines the durable project-owned contract between canonical assets and the permanent visual-analysis capability. It specifies what `services/analysis` must produce and what Gallery, Search, and Ollama may safely consume. It does not prescribe the internal model, framework, inference library, process topology, or build agent.

The production boundary is:

```text
canonical asset
  -> permanent visual analyser
  -> normalized AnalysisRecord
  -> Gallery / Search / Ollama
```

The contract is independent of Manus, ChatGPT, Codex, Gemini, or any other temporary build worker. Runtime/model provenance is recorded, but consumers must not require vendor-native response objects.

## Relationship to the accepted asset contract

Ingest remains authoritative for canonical identity and provenance. This contract does not redesign `packages/asset-schema`.

For v1 ingest:

- `asset_id` is `sha256:<lowercase SHA-256 of exact asset bytes>`;
- `content_hash` has the same algorithm-qualified value;
- canonical blob location is supplied by the accepted `AssetRecord`;
- source occurrences remain ingest-owned records and are not duplicated into Analysis as identity.

Analysis consumes only an accepted canonical asset in a state that permits reading the canonical bytes. Analysis must never replace `asset_id`, derive a new canonical identity from model output, or mutate ingest provenance.

## AnalysisRecord v1

Schema identity:

- `schema`: required constant `analysis-record`;
- `schema_version`: required positive integer, initially `1`.

A conforming record represents one logical analysis state or one persisted terminal result for one canonical asset/input expectation under one declared analysis profile.

### Required top-level fields

| Field | Type | Semantics |
|---|---|---|
| `schema` | string | `analysis-record` |
| `schema_version` | integer | Contract version, initially `1` |
| `analysis_id` | string | Deterministic logical analysis identity; never a provider/build-agent task ID |
| `result_id` | string or null | Unique project-owned persisted terminal result/attempt identity; required for persisted terminal outcomes, nullable for transient `pending`/`processing` state |
| `asset_id` | string | Canonical ingest identity |
| `expected_content_hash` | string | Canonical algorithm-qualified hash Analysis was asked to verify |
| `input_content_hash` | string or null | Verified hash of bytes accepted for inference; null when inference never received verified input |
| `observed_content_hash` | string or null | Optional hash actually observed during verification, especially useful for mismatch diagnostics |
| `status` | enum | `pending`, `processing`, `ready`, `partial`, `unsupported`, `failed`, or `stale` |
| `analysis_profile` | object | Project-owned logical analysis configuration and normalization revision |
| `analyser` | object | Runtime/model provenance used or intended for this logical analysis |
| `analysed_at` | timestamp or null | UTC RFC 3339 terminal-result time; null before completion |
| `summary` | string or null | Human-readable concise description when available |
| `objects` | array | Normalized actually observed/detected object/entity concepts only |
| `categories` | array | Controlled broad classes useful for browsing/filtering |
| `tags` | array | Compact normalized browse/search vocabulary |
| `scene` | object or null | Structured scene/context observations when available |
| `ocr` | object | OCR state/result, including explicit not-run/unsupported/failure semantics |
| `visual_features` | array | Zero or more VisualFeature records/references conforming to `VISUAL-FEATURES.md` |
| `components` | array | Per-capability component states |
| `issues` | array | Normalized warnings/errors/degradation records |
| `overall_confidence` | number or null | Optional aggregate normalized confidence in `[0.0, 1.0]`; absence is not zero |

Empty arrays are preferred over omitted collection fields in persisted v1 records. Optional scalar/object values use `null` when unavailable.

## Hash semantics and inference gate

The three hash fields deliberately distinguish expected canonical identity from bytes actually accepted for inference.

### `expected_content_hash`

`expected_content_hash` is always the canonical content hash supplied by the accepted asset record when the analysis was requested. It is part of logical analysis identity and remains meaningful even when the canonical blob is missing, unreadable, or mismatched before inference.

### `input_content_hash`

`input_content_hash` is the verified hash of bytes actually accepted for inference.

Rules:

- inference MUST run only after the bytes are hashed and the verified hash equals `expected_content_hash`;
- `ready` and `partial` results containing inference-derived visual metadata or features MUST have non-null `input_content_hash` equal to `expected_content_hash`;
- pre-inference missing/unreadable/hash-mismatch outcomes MAY and normally SHOULD have `input_content_hash: null`;
- no consumer may interpret a null `input_content_hash` as proof that inference used the expected bytes.

### `observed_content_hash`

`observed_content_hash` is optional diagnostic evidence from verification. For a hash mismatch it SHOULD contain the algorithm-qualified hash actually observed if hashing completed successfully.

A mismatch such as:

```text
expected_content_hash = sha256:AAA...
observed_content_hash = sha256:BBB...
input_content_hash    = null
status                = stale
issue                 = input_hash_mismatch
```

means rejected bytes were observed but never accepted for inference.

Mismatched bytes MUST NOT produce summary, objects, categories, tags, OCR, scene claims, or visual features as though they belonged to the canonical asset.

## `analysis_profile`

`analysis_profile` identifies the logical project configuration whose normalized outputs are expected to be comparable. It separates project semantics from incidental deployment details.

Required fields:

- `profile_id`: stable project-owned string such as `image-default`;
- `profile_version`: required non-empty STRING, for example `"1"` or `"2026-08-25.1"`;
- `normalization_revision`: required non-empty project-owned STRING identifying the material normalized-output/taxonomy semantics used by the profile.

`profile_version` MUST be serialized and compared as a string. Integer `1` and string `"1"` are not interchangeable producer representations. Producers must not emit numeric profile versions.

A change that can materially change normalized output semantics must change `profile_version`, `normalization_revision`, or both according to the project's profile-versioning policy. Examples include:

- taxonomy/synonym rule changes;
- materially different prompt/inference policy;
- classifier-to-tag mapping changes;
- OCR normalization changes;
- confidence calibration/threshold policy changes;
- material feature component configuration changes.

Optional fields may describe requested/required capability families such as `classification`, `object_detection`, `caption`, `scene`, `ocr`, and `visual_features`. Consumers must not rely on proprietary provider names in this object.

## `analyser`

`analyser` is normalized provenance and approved-analysis eligibility metadata, not canonical asset identity.

Required fields:

- `runtime_id`: deployable runtime/backend identity;
- `runtime_version`: runtime implementation/version;
- `model_id`: model or model-family identifier;
- `model_version`: immutable or sufficiently specific model revision.

Optional fields:

- `device_class`, such as `cpu` or `cuda`, for diagnostics;
- `implementation_version` when different from runtime version.

Forbidden as required consumer fields:

- Manus job/session IDs;
- ChatGPT thread/session IDs;
- Codex task IDs;
- provider-native request/response identifiers.

## Confidence semantics

Every normalized field named or semantically equivalent to `confidence` uses the same bounds.

Where present:

```text
0.0 <= confidence <= 1.0
```

This applies to:

- objects;
- categories;
- tags;
- scene/context;
- OCR aggregate confidence;
- OCR block/line confidence when supplied;
- `overall_confidence`;
- any future normalized confidence field added under this contract.

A producer MUST reject an out-of-range/non-finite value or apply an explicitly documented deterministic normalization rule before persisting the normalized record. Values such as `88`, `-1`, NaN, or Infinity must never appear as normalized confidence values.

Absence of confidence means unavailable/unknown, not zero confidence.

## Objects, classifier labels, categories and tags

These concepts are intentionally distinct so Gallery, Search, and Ollama do not turn classifier guesses into stronger claims than the underlying capability supports.

### `objects`

`objects[]` means actual observed/detected object or entity concepts supported by a capability whose semantics justify an object-presence claim. A whole-image classifier top-K prediction is NOT, by itself, a detected object.

Minimum object shape:

```json
{
  "label": "dog",
  "confidence": 0.91,
  "source": "detector",
  "count": 1
}
```

Rules:

- `label` is required and normalized;
- `confidence` is optional and bounded `[0.0, 1.0]`;
- `source` is a required project-owned capability semantic such as `detector` or another approved grounded/object-presence capability, never a provider-native response path;
- `count` is optional positive integer when technically credible;
- optional region/bounding data may be added later without making boxes mandatory for image v1;
- generic `person` observations/counts are allowed when technically credible;
- face identity and sensitive attribute inference are out of scope.

A detector or suitably grounded visual capability may populate `objects[]`. A classifier-only runtime MUST leave `objects[]` empty unless another actual object-presence capability independently supports the object claim.

### Whole-image classifier predictions

Whole-image classifier predictions may contribute to:

- normalized `tags[]` with `source: "classifier"`;
- controlled broad `categories[]` where the mapping is defensible and profile-versioned;
- cautiously worded summary text where the output remains truthful about classifier semantics.

They MUST NOT automatically populate `objects[]`.

Example: a whole-image classifier predicting `sports car` may normalize to tag `car` with `source: "classifier"` and controlled category `vehicle`. It must not produce `objects: [{"label":"car"}]` solely from that classifier prediction.

Downstream consumers MUST preserve this distinction. A classifier tag means the image-level model associated that concept with the image. It is not proof of a localized/detected object.

### `categories`

Categories are broad controlled classes intended for stable filtering and UI grouping.

Example:

```json
{
  "label": "vehicle",
  "confidence": 0.88,
  "source": "classifier"
}
```

Rules:

- `label` is normalized;
- `confidence`, when present, is bounded `[0.0, 1.0]`;
- `source` is optional but SHOULD identify project-owned origin semantics such as `classifier`, `object`, or `scene` when useful;
- categories remain substantially smaller and more stable than tags.

### `tags`

Tags are normalized retrieval/browsing terms, not a transcript of every model token.

Example:

```json
{
  "label": "car",
  "confidence": 0.86,
  "source": "classifier"
}
```

Rules:

- `label` is required and normalized;
- `confidence`, when present, is bounded `[0.0, 1.0]`;
- `source` is optional but recommended and may be `classifier`, `object`, `category`, `scene`, `ocr-derived`, or another approved normalized origin;
- `source` must not expose provider-native JSON paths or job identities.

## `scene`

`scene` represents structured context, not free-form duplication of the summary. Suggested optional fields include:

- `setting`: for example `beach`, `street`, `kitchen`, `office`;
- `environment`: `indoor`, `outdoor`, `mixed`, or null;
- `time_context`: broad visual observation such as `day`, `night`, or `unknown` when supported;
- `confidence`: bounded `[0.0, 1.0]` when available.

A service may omit unsupported scene fields. It must not fabricate precise location, time, identity, or sensitive attributes from appearance.

## Component state

Each independently degradable capability reports an explicit state.

Minimum shape:

```json
{
  "component": "ocr",
  "state": "ready",
  "detail": null
}
```

Allowed component states:

- `pending`;
- `processing`;
- `ready`;
- `not_requested`;
- `unsupported`;
- `failed`;
- `stale`.

Likely components include `summary`, `classification`, `object_detection`, `scene`, `ocr`, and `visual_features`.

`not_requested` means that component was not part of the requested profile/run. `unsupported` means it was requested but could not be supported for the particular input/runtime/language/media condition. These are not interchangeable.

A requested component that becomes `failed` or `unsupported` is degraded state. If other useful normalized outputs survive, the top-level result is normally `partial` when the profile defines that requested component as part of readiness. A profile may explicitly treat some requested capability as advisory, but it must still preserve the component's `unsupported`/`failed` state and issues rather than presenting it as unrequested.

## `issues`

Issues are normalized diagnostics.

Minimum shape:

```json
{
  "code": "ocr_timeout",
  "component": "ocr",
  "severity": "warning",
  "retryable": true,
  "message": "OCR did not complete before the configured timeout."
}
```

Rules:

- `code` is stable machine-readable project vocabulary;
- `component` identifies affected capability;
- `severity` is `warning` or `error`;
- `retryable` is explicit boolean;
- `message` is human-readable and must not be used as identity;
- native stack traces/raw model payloads may be retained in implementation-local logs but are not required normalized consumer data.

## Logical analysis identity and persisted result identity

The contract distinguishes logical work from individual terminal outcomes.

### `analysis_id`: logical identity

`analysis_id` identifies the logical analysis that was intended, independent of how many times it was attempted.

Two attempts share the same `analysis_id` only when all logical identity inputs are identical:

1. canonical `asset_id`;
2. `expected_content_hash`;
3. `schema` and `schema_version`;
4. `analysis_profile.profile_id`;
5. string `analysis_profile.profile_version`;
6. `analysis_profile.normalization_revision`;
7. currently intended analyser/runtime/model revision required by that profile;
8. any other explicitly versioned project-owned component revision that materially participates in the logical normalized analysis.

`analysis_id` SHOULD be a deterministic collision-resistant project-owned digest over that canonical tuple.

The following do NOT define logical analysis identity:

- retry number;
- `analysed_at`;
- hostname;
- provider request/job ID;
- build-agent task/session/thread ID.

### `result_id`: persisted terminal outcome identity

`result_id` uniquely identifies one persisted terminal result/attempt under an `analysis_id`.

Rules:

- every persisted terminal `ready`, `partial`, `unsupported`, `failed`, or `stale` outcome MUST have a non-null `result_id`;
- two distinct terminal outcomes from retrying the same `analysis_id` MUST have distinct `result_id` values;
- a failed or partial attempt and a later successful retry MAY share `analysis_id` but MUST NOT share `result_id`;
- `result_id` must be project-owned and provider-independent;
- `result_id` must not be a Manus job ID, ChatGPT thread ID, Codex task ID, or another temporary provider/build-agent execution identifier;
- transient `pending`/`processing` state may use `result_id: null` until a terminal result is persisted.

A project-owned UUID or collision-resistant ID generated by the Analysis persistence layer is acceptable. The exact generation algorithm is an implementation choice as long as uniqueness, persistence, and provider independence are preserved.

Historically useful terminal outcomes are immutable/auditable records and must not be silently overwritten by a later retry.

### Exact provenance for Search/index records

When Search or another downstream index must identify the exact historical normalized payload it consumed, it MUST store `result_id` and SHOULD also store `analysis_id`.

- `analysis_id` answers: which logical analysis/profile/revision?
- `result_id` answers: which exact persisted terminal outcome?

Using only `analysis_id` is insufficient for exact historical provenance when multiple retries produced terminal results under the same logical analysis.

## Re-analysis and versioning

A new logical `analysis_id` is required when any logical identity input changes, including:

- canonical asset/expected content hash;
- analysis schema/version;
- analysis profile ID/version;
- material normalization/taxonomy revision;
- approved analyser/model/runtime revision when it materially participates in output semantics;
- OCR engine revision where the profile makes OCR engine choice part of the logical analysis revision;
- other materially versioned component semantics.

A retry of the same logical analysis keeps the same `analysis_id` but creates a new `result_id` if a new terminal outcome is persisted.

Multiple logical analysis versions and multiple terminal results per logical analysis may coexist for one asset. This is required for model upgrades, retries, profile changes, schema migrations, evaluation, rollback, and provenance.

No consumer may assume there is exactly one AnalysisRecord per `asset_id` or one terminal record per `analysis_id`.

## Stale detection

Before inference begins, Analysis must verify the bytes at the authorised canonical locator against `expected_content_hash`.

If the blob is missing, unreadable, or mismatched:

- do not run inference on unverified/rejected bytes;
- persist/return the appropriate normalized terminal outcome with a distinct `result_id` when terminal state is recorded;
- leave `input_content_hash` null if no bytes were accepted for inference;
- record `observed_content_hash` on a completed mismatch hash when useful;
- do not mutate `asset_id` or ingest provenance;
- require canonical storage/ingest ownership to resolve a true canonical mismatch.

A previously persisted inference result is stale for current consumption whenever its `input_content_hash` no longer equals the current accepted canonical content hash for the referenced asset revision, or when its profile/analyser/component revision is no longer approved as current.

Because v1 `asset_id` is content-addressed, a genuine byte change normally produces a new canonical `asset_id`, but consumers must still validate the explicit hash fields.

## Current/preferred result selection

Current/preferred selection is deterministic and filters eligibility before ranking success state.

For normal current truth, consumers should apply this order:

1. **Current canonical input eligibility:** `asset_id` and `expected_content_hash` match the current canonical asset expectation; inference-bearing `ready`/`partial` results also have `input_content_hash == expected_content_hash`.
2. **Schema eligibility:** schema/version is supported by the consumer.
3. **Profile eligibility:** analysis profile ID, string profile version, and normalization revision are the currently approved values for that media class/use.
4. **Analyser/component eligibility:** analyser/model/runtime revision and any required component/extractor revisions are currently approved for that profile.
5. **Status ranking:** among otherwise equivalent approved candidates, prefer `ready` over `partial`. `unsupported`/`failed` remain state evidence but are not rich current metadata sources.
6. **Deterministic tie-break:** within otherwise equivalent approved terminal results, prefer newest `analysed_at`; if timestamps tie, use stable lexical `result_id` ordering or another documented deterministic project rule.

`stale`, `pending`, and `processing` records are never preferred completed metadata.

A superseded analyser/model/profile `ready` result MUST NOT automatically outrank a current approved revision's `partial` result. Superseded/historical revisions are ineligible for normal current selection before status ranking occurs.

Any fallback to a historical/superseded profile or analyser revision must be an explicit product/retrieval mode, clearly labelled historical/fallback, and must not be presented or indexed as current truth by default.

A future dedicated preferred-analysis registry/pointer may centralize these approvals. That is an architecture/storage decision, not a reason to overwrite old records.

## Model upgrades

Model upgrades create a new logical analysis revision whenever the approved analyser/model revision materially changes output semantics. Old results remain historically available.

Rollout should support shadow evaluation before the new revision becomes approved/current. Downstream consumers should not need a schema change merely because the model changes when normalized contract semantics remain compatible.

## Downstream rebuild triggers

Search/index state is derived and must become stale/rebuild-required whenever relevant input identity changes. Triggers include:

- preferred exact `result_id` changes for indexed Analysis content;
- logical `analysis_id` changes;
- normalized summary/tag/category/OCR fields included in an index change;
- analysis schema/profile/normalization revision changes;
- approved analyser/model revision changes;
- VisualFeature compatibility key changes, including mandatory `feature_extractor_revision`;
- canonical expected/input hash no longer matches;
- OCR engine/text revision changes when OCR is indexed.

Indexes that require exact historical provenance MUST store `result_id`; they SHOULD also store `analysis_id`, schema/profile revision, and relevant feature compatibility identity so stale state is detectable without comparing full payloads.

## Top-level status model

Top-level status is a state machine, not a success boolean.

| Status | Meaning | Gallery | Search | Ollama |
|---|---|---|---|---|
| `pending` | Analysis is requested but not started | Browse asset normally; optional pending state | Do not index unavailable new analysis | Reason only from canonical/source metadata or earlier valid result |
| `processing` | Active attempt is running | Browse asset normally | Continue serving an earlier valid preferred result if one exists; do not consume incomplete output | Use earlier valid metadata if present |
| `ready` | Approved profile readiness requirements succeeded | Show normalized current metadata | Index valid current normalized fields/features | Ground reasoning in current normalized record |
| `partial` | Useful normalized output exists but requested capability is degraded/failed/unsupported | Show available fields plus degraded state | Index only valid components and exact result provenance | Use available fields while preserving uncertainty/degradation |
| `unsupported` | Requested analysis/profile cannot be supported for this input/runtime/media | Browse asset normally | Typed unavailable state; no false successful index input | Reason from non-analysis metadata |
| `failed` | Attempt produced no useful normalized result | Browse asset normally; failure/retry state optional | Do not index as successful metadata | Do not infer missing visual facts |
| `stale` | Result/input/profile/analyser revision is not valid current truth | Do not present as current; historical display must be labelled | Exclude from current indexes | Do not ground current assertions in it |

Normal transitions include:

```text
pending -> processing -> ready
                     -> partial
                     -> unsupported
                     -> failed

ready/partial/failed/unsupported -> stale
stale -> processing -> terminal result
failed -> processing -> terminal result
```

Implementation persistence may represent transient `pending`/`processing` separately from immutable terminal result records, but the service boundary must expose the semantics.

## Tag and taxonomy normalization

The objective is a compact stable vocabulary, not an unstable tag swamp.

Rules:

1. Normalize to Unicode-aware lowercase/casefolded human-readable terms.
2. Trim leading/trailing whitespace and collapse internal whitespace.
3. Prefer plain singular concepts where unambiguous (`cars` -> `car`, `dogs` -> `dog`) using controlled rules, not blind suffix stripping.
4. Apply only curated high-confidence synonyms.
5. Suppress exact duplicates after normalization and retain strongest defensible confidence/provenance.
6. Keep object, category and tag semantics distinct.
7. Whole-image classifier predictions may become `source: "classifier"` tags and controlled categories but never detected objects solely from classification.
8. Do not turn summary sentence fragments into tags automatically.
9. Low-confidence classifications should be omitted from ordinary tags or represented with explicit uncertainty, not promoted as facts.
10. Order tags deterministically, preferably descending confidence then lexical tie-break.
11. V1 SHOULD cap ordinary normalized tags at 24 per asset unless evaluation documents a reason for more.
12. Broad concepts such as `car`, `dog`, `beach`, `receipt`, `document`, `screenshot`, `food`, `night`, `indoor`, and `outdoor` are legitimate when supported by the responsible capability.
13. Do not infer protected/sensitive personal attributes from appearance.

Confidence thresholds and classifier-to-taxonomy mappings are profile-owned and versioned. The contract does not mandate one universal numeric threshold because model calibration differs.

## OCR semantics

OCR is a separate capability from descriptive metadata/tags.

Successful example:

```json
{
  "state": "ready",
  "engine": {
    "engine_id": "local-ocr",
    "engine_version": "1.0"
  },
  "text": "TOTAL $12.50",
  "language": "en",
  "confidence": 0.93,
  "blocks": []
}
```

### Required OCR state meanings

- `not_requested`: OCR was not part of the requested profile/run. No OCR attempt was expected for this run.
- `unsupported`: OCR WAS requested, but the input/runtime/language/media condition could not be supported by the selected OCR capability.
- `ready` with non-empty `text`: OCR ran successfully and detected text.
- `ready` with empty `text`: OCR ran successfully and detected no text.
- `failed`: OCR was requested and attempted but did not produce a valid OCR result.
- `pending` / `processing` / `stale`: use the component-state meanings defined above.

`not_requested` and `unsupported` MUST NOT be collapsed. Requested-but-unsupported OCR is degraded capability evidence and participates in top-level readiness/partial semantics according to the profile.

### OCR engine provenance

When OCR has `state: ready`, the `engine` object is mandatory and MUST contain both:

- `engine_id`: stable normalized engine identity;
- `engine_version`: specific approved engine revision as a string.

Search/audit must be able to distinguish successful OCR produced by different engine revisions.

When OCR is `failed` after an attempt, engine provenance SHOULD be recorded when known. When OCR is `not_requested`, an engine is not required.

Other rules:

- `text` is extracted text, not a descriptive label;
- OCR `confidence`, when present, is bounded `[0.0, 1.0]`;
- `language` is optional and may be null/unknown;
- `blocks`/`lines` are optional for image v1;
- if blocks/lines include confidence, the same `[0.0, 1.0]` bounds apply;
- if bounding boxes are emitted, their coordinate space/version must be explicit;
- OCR strings must not be copied wholesale into tags;
- controlled document concepts may be derived separately when supported;
- OCR failure may produce top-level `partial` when other analysis remains useful.

## Image v1 and future video boundary

Image analysis is the concrete v1 target. Full video intelligence is not required for image-v1 acceptance.

Future video support must retain parent canonical identity:

- whole-video AnalysisRecord remains keyed by the parent video `asset_id` and parent expected/verified content hash semantics;
- sampled frames/keyframes carry parent `asset_id`, parent content hash, and precise timestamp/time range;
- frame-derived analysis may use a project-owned derivative/reference ID, but it never replaces the canonical parent asset ID;
- derivative IDs should be deterministic from parent revision plus sampling specification/timestamp if persisted;
- frame features must identify whether they represent a frame, region, temporal aggregate, or whole-video family;
- Search must not compare incompatible image/frame/video feature families merely because dimensions match.

No image-v1 implementation is required to create video child assets or a full scene graph. Creating canonical frame child assets requires architect approval because Ingest owns canonical asset creation.

## People and face boundary

Face/person identity recognition is out of scope.

Allowed generic observations include:

- `person` present when supported by an object-presence capability;
- visible person count when technically credible.

Not allowed without separate architecture/privacy approval:

- identifying/naming a person from a face;
- persistent face embeddings for recognition;
- hidden face clustering intended to infer identity;
- sensitive personal attribute inference from appearance.

## Failure semantics

Failures must not mutate canonical identity/provenance or corrupt previous valid analysis.

| Condition | Required behavior |
|---|---|
| Missing canonical blob | Terminal typed `missing_input`; `expected_content_hash` retained; `input_content_hash` null; previous valid results preserved |
| Unreadable canonical blob | Typed failure; `input_content_hash` null unless verification completed and bytes were accepted; no fallback identity |
| Corrupt media | `failed` with `corrupt_media` unless independently valid components justify `partial` after verified input |
| Unsupported media | `unsupported`, not generic `failed`; hash fields reflect whether verification completed before support decision |
| Model/runtime unavailable | `failed` or transient processing failure with `model_unavailable`, retryable when appropriate |
| Inference timeout | `failed` if nothing useful completed; `partial` if independently valid outputs survived |
| OCR requested but unsupported | OCR `unsupported`; top-level degraded/partial according to profile readiness semantics |
| Partial OCR failure | OCR `failed`; top-level `partial` when non-OCR analysis is useful |
| Partial model/component failure | `partial` only when surviving normalized output is independently valid |
| Input hash mismatch | `expected_content_hash` canonical; `input_content_hash` null; optional differing `observed_content_hash`; no inference; `stale`/`input_hash_mismatch` outcome |
| Stale persisted analysis | Exclude from current preferred/index consumption; retain historically |
| Malformed native model response | Fail closed through normalized validation; no raw malformed payload passed to consumers |
| Retry | Same logical `analysis_id` when logical inputs are unchanged; new distinct `result_id` for each new terminal outcome |
| Re-analysis | New `analysis_id` when logical profile/model/schema/input semantics change; preserve historical results |

## Downstream requirements

### Gallery

Gallery may rely on:

- stable `asset_id` linkage;
- current analysis state;
- human-readable summary;
- normalized tags/categories/objects with their semantic distinction preserved;
- OCR text/state when available;
- degraded/issues state suitable for user display;
- analyser/profile provenance for diagnostics if exposed.

Gallery must remain able to browse canonical assets when Analysis is unavailable, failed, pending, unsupported, or stale.

Gallery must not present classifier-sourced tags as detected/localized objects.

### Search

Search may rely on:

- `asset_id`, `expected_content_hash`, and verified `input_content_hash` when inference output exists;
- supported schema/profile/analyser revisions;
- exact `result_id` for historical/index provenance;
- `analysis_id` for logical revision grouping;
- normalized summary/tags/categories/OCR for deterministic or semantic indexing;
- VisualFeature compatibility metadata sufficient to isolate vector families;
- explicit status/component state and stale detection.

Search must not import an Analysis model SDK or parse provider-native model JSON. It must preserve classifier-vs-object semantics when indexing fields.

### Ollama

Ollama may rely on:

- normalized structured fields;
- source/provenance semantics for classifier tags versus actual objects;
- confidence/uncertainty and issue state;
- `analysis_id`, `result_id`, profile/model provenance, and timestamps;
- grounding back to canonical `asset_id`.

Ollama must not turn a classifier tag into a claim that an object detector found/localized that object. It must not treat low-confidence, unsupported, or stale assertions as certain current facts and must not require the native visual model response.

## Provider independence

A conforming production contract MUST NOT require fields or runtime dependencies such as:

- `manus_job_id`;
- `manus_response`;
- `chatgpt_thread`;
- `codex_task`;
- Manus SDK imports or Manus-hosted inference;
- OpenAI/ChatGPT APIs merely because ChatGPT authored this specification;
- Codex Cloud runtime APIs;
- proprietary build-agent response payloads for downstream interpretation.

Project-owned provenance fields such as `runtime_id`, `runtime_version`, `model_id`, `model_version`, `analysis_id`, and `result_id` are permitted and encouraged.

## Static dependency regression checks

CI/review SHOULD scan production source and manifests for accidental build-agent coupling. Cover at least `services/`, `apps/`, `packages/`, deployment manifests, and lockfiles while excluding clearly historical migration documentation and agent/handoff prose.

Patterns requiring review include:

```text
MANUS_API
manus.ai
space.manus
Manus SDK/package imports
ChatGPT build-session/thread identifiers used as production identity
Codex Cloud API/client imports or runtime endpoints
build-agent credential names introduced into production configuration
```

A textual mention in historical migration documentation is not a production dependency. A runtime import, required environment variable, network endpoint, or canonical field is.

## Contract compatibility rule

Implementations may add backward-compatible optional fields. Removing fields, changing meanings, changing enum semantics, weakening hash/identity requirements, changing classifier/object semantics, changing normalization behavior incompatibly, or making previously optional components mandatory requires a schema/profile version change and consumer compatibility review.

If an implementation needs a change to the accepted ingest asset schema, it must document the proposal for architect approval rather than silently editing `packages/asset-schema`.
