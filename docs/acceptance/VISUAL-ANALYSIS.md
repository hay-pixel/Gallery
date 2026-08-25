# Visual Analysis Acceptance

## Purpose

This document is the acceptance lens for an implementation of the permanent visual-analysis capability under `services/analysis`. It evaluates boundary correctness, provider independence, failure behaviour, and useful normalized output without dictating the internal model implementation.

Acceptance is not satisfied merely because code compiles or a demo image receives a plausible label.

## Required contract behaviour

A conforming implementation must:

- consume canonical `asset_id`, accepted canonical hash, and an authorised canonical locator;
- preserve `expected_content_hash` as the hash requested for verification;
- verify exact bytes before inference and populate `input_content_hash` only for bytes accepted by the inference gate;
- optionally record `observed_content_hash` for completed mismatch diagnostics;
- emit normalized `analysis-record` v1 semantics from `docs/contracts/VISUAL-ANALYSIS.md`;
- distinguish logical `analysis_id` from persisted terminal `result_id`;
- emit or expose visual features conforming to `docs/contracts/VISUAL-FEATURES.md` when the selected profile includes visual features;
- preserve canonical identity and ingest provenance on every success/failure path;
- retain enough revision metadata to detect stale analysis and trigger downstream rebuilds;
- preserve classifier-vs-detected-object semantics;
- remain usable after the temporary build agent is disconnected;
- avoid required provider-native payloads in downstream-facing records.

## Objective contract tests

The implementation should include automated tests proving at minimum:

1. schema name/version are explicit and validated;
2. `asset_id` and `expected_content_hash` are required and algorithm-qualified;
3. `input_content_hash` is nullable for pre-inference failure and required for `ready`/`partial` inference-bearing output;
4. a hash mismatch fails closed before inference, leaves `input_content_hash` null, and may record a differing `observed_content_hash`;
5. no visual metadata/features are emitted from rejected mismatched bytes;
6. `analysis_profile.profile_version` is a required string with canonical serialization;
7. analysis profile normalization revision is explicit and participates in logical identity;
8. `analysis_id` is deterministic for the same logical asset/input/schema/profile/analyser/normalization revision;
9. retries of the same logical analysis may share `analysis_id` but distinct persisted terminal outcomes have distinct `result_id` values;
10. older terminal results are not silently destroyed;
11. a model/profile/schema/material normalization revision change creates a distinct logical analysis revision;
12. current/preferred selection filters to the approved profile/analyser/model/component revision before ranking `ready` over `partial`;
13. superseded analyser `ready` output cannot automatically beat current-approved `partial` output;
14. stale records are not selected as current/preferred results;
15. every normalized confidence value is finite and bounded `0.0..1.0`, or deterministically normalized before persistence under documented producer rules;
16. empty lists serialize predictably;
17. malformed native model output does not escape as canonical consumer JSON;
18. unsupported input is distinguished from generic failure;
19. partial component failure can preserve valid surviving components;
20. whole-image classifier predictions do not automatically populate `objects[]`;
21. classifier-derived tags identify `source: classifier` when provenance is represented;
22. actual `objects[]` entries are supported by detector/grounded object-presence semantics rather than classifier top-K alone;
23. visual feature dimensionality must match value length;
24. non-finite feature values are rejected;
25. `feature_extractor_revision` is mandatory and changes for material extraction/preprocessing changes;
26. incompatible visual-feature model/version/extractor/dimension/metric/normalization combinations are distinguishable;
27. feature source hash matches the exact verified inference input revision;
28. external vector payloads are self-describing with storage reference, project-owned format, dtype, byte order where applicable, dimensions and checksum;
29. external payload integrity failure is detectable without Analysis implementation knowledge;
30. OCR successful output records required engine ID/version provenance;
31. OCR `not_requested`, `unsupported`, `ready` empty-text, and `failed` states remain distinct;
32. raw build-agent IDs are not required contract fields;
33. basic canonical asset browsing does not depend on Analysis being available.

## Fixture/evaluation matrix

The fixture set should contain rights-safe local test assets generated for the repository or otherwise explicitly suitable for redistribution. Fixtures should be small enough for CI where practical. Large model-quality evaluation may use a separately documented evaluation set without committing private media.

| Fixture class | Required inspectable expectations |
|---|---|
| Ordinary phone photo | Terminal `ready` or justified `partial`; useful normalized summary/tags where supported; classifier-only runtime does not falsely claim detected objects |
| Landscape | At least one broad scene/environment concept when supported; no invented precise location |
| Pet | Useful animal/pet tag/category when supported; classifier-only result remains tag/category rather than false detector output |
| Vehicle | Useful vehicle concept when supported; classifier-only prediction may normalize to classifier tag/category but not detected `objects[]` |
| Food | Useful food concept when supported; no recipe/ingredient hallucination requirement |
| Indoor room | Scene/environment may represent `indoor`; tag count remains bounded |
| Screenshot | Not treated solely as a natural-camera scene; OCR may be useful; screenshot/document concept evaluated where supported |
| Receipt | OCR-capable requested profile separates extracted text from descriptive tags; document/receipt concept useful if supported |
| Document | OCR state explicit; no-text, not-requested, unsupported and failed remain distinguishable |
| Image containing text | OCR output separate from descriptive metadata; OCR failure can degrade to `partial` without discarding valid unrelated analysis |
| Dark/low-quality image | Must not fabricate certainty; may return low-confidence/partial/limited output with warnings |
| Unusual aspect ratio | Processes without geometry assumptions causing crash/corrupt output; vector dimensions and extractor revision remain contract-correct |
| Corrupt input | Typed `failed`/`corrupt_media`; canonical identity unchanged; no rejected bytes inferred as current truth |
| Unsupported format | Typed `unsupported`; no generic provider/native stack trace as contract result |

## Quality evaluation rules

Quality must combine objective checks with bounded human review.

### Objective metrics

For representative supported fixtures, record:

- terminal success rate by fixture class;
- partial/failure/unsupported rate;
- tag count distribution;
- duplicate normalized-tag rate, target zero;
- invalid normalized confidence count, target zero;
- classifier-as-object semantic violations, target zero;
- schema-validation pass rate, target 100%;
- canonical hash/inference-gate correctness, target 100%;
- logical-ID/result-ID retry correctness, target 100%;
- preferred-selection eligibility correctness, target 100%;
- visual-feature dimensionality/integrity pass rate, target 100%;
- feature compatibility/extractor revision correctness, target 100%;
- external-vector descriptor/integrity validation, target 100% for external payload fixtures;
- OCR state/provenance consistency, target 100%;
- provider-coupling static check, target no prohibited production dependency.

### Human usefulness review

For ordinary supported images, a reviewer should be able to answer yes/no:

- Is the summary materially related to visible content?
- Are the top tags useful for browsing/search?
- Are broad categories defensible?
- Does the record avoid overstating classifier predictions as detected objects?
- Is uncertainty preserved when the image is ambiguous/poor quality?
- Is there obvious tag spam or sentence-fragment pollution?
- Does OCR text reflect visible text rather than descriptive speculation?

A single subjective score must not be the sole acceptance gate. Record examples of failure modes and objective regressions alongside human review.

## Suggested minimum tag/object quality gates

For v1 fixtures:

- normalized labels are lowercase/casefolded according to contract;
- leading/trailing/repeated whitespace is absent;
- exact normalized duplicates are absent;
- ordinary tag count should not exceed 24 without documented justification;
- deterministic ordering is stable for identical normalized input;
- confidence threshold behaviour is profile-versioned;
- obvious low-confidence tail noise is not dumped into tags;
- summaries are not tokenized wholesale into tags;
- classifier-only predictions use classifier tag/category semantics, not detected-object semantics;
- any populated `objects[]` entry has project-owned source semantics that justify an actual object-presence claim.

## Confidence acceptance

Automated contract tests must exercise confidence validation for every normalized confidence-bearing structure implemented, including:

- objects;
- categories;
- tags;
- scene;
- OCR aggregate;
- OCR blocks/lines if present;
- overall/aggregate confidence.

Values below `0.0`, above `1.0`, NaN and Infinity must not survive normalized persistence. If the producer converts model-native percentages/logits/scores, the deterministic normalization rule must be documented and profile-versioned when material.

## OCR acceptance

OCR is optional per profile/media, but once requested its outcome semantics are strict.

Acceptance cases:

- successful OCR with text: `state=ready`, text non-empty, `engine_id` and `engine_version` both present;
- successful OCR with no text: `state=ready`, text empty, `engine_id` and `engine_version` both present;
- OCR not requested by profile/run: `state=not_requested`;
- OCR requested but unsupported for input/runtime/language/media: `state=unsupported`, not `not_requested`;
- OCR requested and attempted but failed: `state=failed`;
- OCR failure while other analysis succeeds: top-level `partial` when OCR participates in profile readiness, other valid metadata preserved;
- requested-but-unsupported OCR participates in degraded/partial semantics according to profile readiness policy;
- language may be null/unknown without failing the record;
- bounding boxes are optional unless implementation claims them, in which case coordinates, coordinate space and confidence bounds validate.

## Failure and retry acceptance

### Missing canonical blob

Expected:

- normalized missing-input issue;
- `expected_content_hash` remains canonical requested hash;
- `input_content_hash` is null;
- no inference against an arbitrary fallback path;
- no new canonical asset identity;
- previous valid analysis remains intact;
- persisted terminal outcome has its own `result_id`.

### Input hash mismatch

Expected:

- hash is recomputed/verified before inference;
- `expected_content_hash` equals canonical requested hash;
- mismatch blocks inference;
- `input_content_hash` remains null;
- `observed_content_hash` may contain the differing hash actually observed;
- no summary/tag/object/OCR/feature output is created from mismatched bytes as current asset truth;
- stale/hash-mismatch outcome is explicit;
- canonical `asset_id` and ingest record remain unchanged.

### Model unavailable

Expected:

- typed retryable failure where appropriate;
- no fake empty `ready` result;
- no dependency on a temporary build worker fallback;
- retry can retain the same logical `analysis_id` when all logical inputs remain unchanged.

### Inference timeout

Expected:

- typed timeout issue;
- `partial` only if surviving outputs are independently valid;
- otherwise `failed`;
- every new persisted terminal retry outcome gets a new `result_id`;
- prior terminal evidence remains auditable.

### Malformed model response

Expected:

- parser/normalizer rejects malformed native response safely;
- raw malformed shape is not forwarded to Search/Gallery/Ollama;
- result becomes `failed` or `partial` according to independently valid surviving components.

## Identity/version acceptance

At minimum, exercise these sequences:

### Retry sequence

```text
same asset + expected hash + schema/profile/analyser/normalization
  -> failed result A: analysis_id X, result_id A
  -> retry
  -> ready result B:  analysis_id X, result_id B
```

Required: `A != B`; both terminal outcomes remain auditable; preferred current selection chooses B if otherwise eligible.

### Model/profile upgrade sequence

```text
old approved revision -> analysis_id X
new approved revision -> analysis_id Y
```

Required: `X != Y`; old `ready` record is historical/superseded and cannot outrank current-approved `partial` merely because its status is `ready`.

### Index provenance

When Search indexes exact normalized output, the index metadata must be able to record exact `result_id` plus logical `analysis_id` so a later retry under the same logical analysis cannot make provenance ambiguous.

## Visual feature acceptance

Search-facing feature tests must prove:

- canonical `asset_id` and verified input hash included;
- feature type/model/version explicit;
- mandatory `feature_extractor_revision` present;
- dimensions positive and exact;
- values finite;
- similarity family explicit;
- normalization semantics explicit;
- material resize/crop/transform/tokenizer/pooling/preprocessing/postprocessing/normalization changes require a changed extractor revision;
- model replacement or extractor revision change creates a distinct compatibility family;
- incompatible families cannot accidentally enter the same comparison/index path;
- external-only storage carries `storage_reference`, project-owned `storage_format`, `dtype`, `byte_order` where applicable, dimensions and checksum;
- Search can decode and checksum an external vector from the normalized record alone;
- a vendor-specific storage name alone is insufficient;
- features can be regenerated from canonical bytes and the approved permanent runtime;
- exact duplicate decisions are not made from visual similarity alone.

## Static provider-independence gate

Run a repository scan over production code/manifests and investigate matches for:

```text
MANUS_API
manus.ai
space.manus
Manus SDK/package imports
ChatGPT build-session or thread identifiers used in runtime persistence
Codex Cloud runtime/API dependencies
provider-specific response objects required by Search/Gallery/Ollama
```

Allowed matches:

- historical migration docs;
- agent role docs;
- handoff/review prose explaining that these dependencies are forbidden;
- tests intentionally asserting absence.

Not allowed without explicit architecture approval:

- required runtime env vars/secrets;
- production imports/SDK dependencies;
- network calls to temporary build-agent services;
- canonical schema/result identity fields whose meaning is a build-agent session/job identifier.

## Manus 1 PR #7 acceptance checklist

Apply the following to the Visual-1 implementation PR:

- [ ] Scope remains limited to owned Analysis implementation/docs/tests and does not redesign ingest/search/gallery/ollama/assist.
- [ ] Consumes accepted canonical `asset_id` and canonical hash without redefining identity.
- [ ] Represents `expected_content_hash`, verified `input_content_hash`, and optional observed mismatch hash with correct pre-inference semantics.
- [ ] Verifies exact bytes before inference and never analyses rejected mismatch bytes as current asset truth.
- [ ] Normalized consumer contract is provider-independent.
- [ ] `analysis_profile.profile_version` is a canonical string and material normalization revision is explicit/versioned.
- [ ] `analysis_id` is logical deterministic identity rather than terminal-attempt identity.
- [ ] Every persisted terminal attempt/result has a distinct project-owned `result_id` when retries produce multiple outcomes.
- [ ] Search can retain exact `result_id` provenance for indexed normalized output.
- [ ] Top-level state semantics can represent pending/processing/ready/partial/unsupported/failed/stale, even if transient states are stored separately.
- [ ] Preferred selection checks current approved profile/analyser/model/component revisions before ranking `ready` over `partial`.
- [ ] Historical/superseded analyser fallback is explicit and labelled, never automatic current truth.
- [ ] Tags are normalized, deduplicated, bounded and ordered deterministically.
- [ ] Classifier-only predictions do not populate `objects[]` as detected objects.
- [ ] Classifier-derived browse concepts can be represented as tags with `source: classifier` and controlled broad categories.
- [ ] Populated `objects[]` require detector/grounded object-presence semantics.
- [ ] All normalized confidence fields enforce `0.0..1.0` bounds.
- [ ] Categories, objects, tags, summary and OCR remain semantically distinct.
- [ ] OCR state distinguishes not-requested, requested-but-unsupported, successful no-text, and failed.
- [ ] Successful OCR always records engine ID/version provenance.
- [ ] Generic people observations do not become face/person identity recognition.
- [ ] Sensitive attributes are not inferred.
- [ ] Visual features include mandatory `feature_extractor_revision` and sufficient compatibility metadata for Search.
- [ ] Material extraction/preprocessing changes cannot remain in the same compatibility key merely because model weights are unchanged.
- [ ] External vector storage, if supported, is self-describing and integrity-checkable without Analysis internals.
- [ ] Incompatible vector families cannot be mixed silently.
- [ ] Search need not import the Analysis model/runtime SDK.
- [ ] Missing/corrupt/unsupported/hash-mismatch/model-unavailable/timeout/malformed-response paths are tested.
- [ ] Failed analysis cannot mutate canonical asset identity/provenance.
- [ ] Basic Gallery browsing remains possible without analysis results.
- [ ] Build-agent-specific credentials/runtime IDs are not production requirements.
- [ ] Runtime can credibly execute on the canonical VM or another explicitly approved permanent runtime.
- [ ] Tests distinguish fixture simulation from real runtime/model verification.
- [ ] Handoff documents what was implemented, tested, runtime-verified, and still unverified.

## Acceptance outcome categories

A reviewer should report findings as:

- **Contract pass**: boundary/identity/hash/version/state/provider/semantic rules satisfied.
- **Quality pass**: representative fixture behaviour meets objective and human-usefulness gates.
- **Runtime verified**: approved permanent runtime actually executed, preferably on target-like CPU/VM environment.
- **VM verified**: canonical VM execution and persistence/restart tested.
- **E2E verified**: real canonical asset from ingest reaches analysis and downstream index/Gallery flow.

Do not collapse these into one vague "works" statement.
