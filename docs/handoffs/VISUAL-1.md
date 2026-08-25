# Visual 1 — permanent visual-analysis runtime handoff

**Owner:** Visual Analysis Builder

**Scope:** `services/analysis/**` and this handoff only

**Branch:** `manus/visual-analysis-runtime`

**Status:** contract-aligned implementation and local runtime verification complete; canonical-VM and ingest-to-product verification remain pending.

## Alignment summary

The existing CPU-first visual-analysis runtime was surgically aligned to the merged [`Visual Analysis`](../contracts/VISUAL-ANALYSIS.md) and [`VisualFeature`](../contracts/VISUAL-FEATURES.md) contracts. The local PyTorch/TorchVision ResNet-18 ImageNet-1K v1 model, 512-dimensional L2-normalized feature, canonical byte verification, atomic writes, idempotent current-result reuse, optional local OCR boundary, and no-hosted-inference architecture were preserved.

The alignment did **not** modify Ingest, shared asset schemas, Search, Gallery, Assist, or Ollama. It changes the Analysis-owned normalized record/persistence boundary so later Search work can preserve exact terminal-result provenance without importing the model runtime.

> **Provider/build-agent independence remains intact.** Production analysis source and runtime configuration require no temporary build-worker API, SDK, credential, hosted inference service, task ID, response shape, callback, or endpoint.

## Contract-aligned behavior

| Contract area | Implemented behavior |
|---|---|
| Logical versus terminal identity | Deterministic `analysis_id` includes canonical asset/expected hash, analysis schema, profile/version, normalization revision, analyser and component semantics. Every terminal result receives a distinct project-owned UUIDv4 `result_id`. |
| Terminal history | Terminal outcomes are immutable `<result_id>.json` records beneath logical analysis storage. A separate atomic current pointer selects eligible `ready`, `partial`, or `unsupported` results without overwriting history. |
| Hash gate | `expected_content_hash` remains the requested canonical hash. `input_content_hash` is null before accepted inference and equals expected hash only after verification. Hash mismatch records a differing `observed_content_hash`, returns `stale`, and emits no summary/tags/OCR/features. |
| Status vocabulary | Model supports `pending`, `processing`, `ready`, `partial`, `unsupported`, `failed`, and `stale`. The synchronous service persists terminal outcomes; transient orchestration records are representable but not persisted by this worker. |
| Profile/versioning | Project-owned `analysis_profile` has string `profile_version`, explicit taxonomy `normalization_revision`, requested components, and material component revisions. |
| Classifier semantics | Classifier top-K predictions become controlled `tags[]` and broad `categories[]` with `source: classifier`; classifier-only output leaves `objects[]` empty. |
| OCR | Separate `ocr` record distinguishes `not_requested`, requested `unsupported`, successful `ready` empty/non-empty text, and `failed`. Successful OCR requires engine ID/version provenance. |
| VisualFeature | `visual-feature` v1 includes canonical asset ID, verified input hash, feature type/model/version, mandatory extractor revision, dimensions, cosine family, explicit L2 normalization, finite inline values, and analysis/result provenance. |

The current pointer ranks eligible results as `ready` over `partial` over `unsupported`, then terminal timestamp and lexical UUIDv4 result ID. Failed/stale results remain in immutable history for audit and retry but are not reused as current metadata.

## Selected local runtime

| Component | Image-v1 selection |
|---|---|
| Classification | TorchVision ResNet-18 ImageNet-1K v1 on CPU. |
| Feature | 512-dimensional pre-classifier vector, L2-normalized; extractor revision `resnet18-rgb-224-center-crop-avgpool-l2-v1`. |
| OCR | Optional local Tesseract adapter; disabled unless explicitly configured. |
| Excluded | Hosted image inference, face/person identity matching, sensitive-attribute inference, object detection, caption generation, and video analysis. |

The model remains a modest CPU baseline rather than a generalized visual-understanding claim. Classifier labels are intentionally not represented as detected object evidence. TorchVision publishes preprocessing with each weight and cautions deployers to assess applicable weight terms.[1]

## Verification evidence

The deterministic suite was expanded from 10 to **15 passing tests**. It now covers valid ready records, classifier-versus-object separation, expected/input/observed hash semantics, corrupt/missing input, model failure boundaries, idempotent current reuse, forced immutable rerun history, failed-then-ready retry history, deterministic logical identity with profile-normalization revision, UUIDv4 terminal identity, OCR state/provenance rules, feature finite/dimension/compatibility validation, and production dependency regression.

```bash
cd services/analysis
ruff format src tests scripts
ruff check src tests scripts
mypy src
python3 -m compileall -q src scripts
cd ../..
python3 -m pytest services/analysis/tests
# Result: 15 passed
```

A post-alignment real local CPU run used a temporary public dog image fixture with SHA-256 `f3f87bb8ab3c26c7ecfd3ac60421d7f32b0503d1d6c5baf8bac42ed93d86351a`. The CPU-only Torch `2.5.1+cpu` / TorchVision `0.20.1+cpu` model returned a `ready` result with a `samoyed` classifier tag at `0.884622`, no false objects, matching expected/input hashes, a UUIDv4 result ID, and a 512-dimensional unit-normalized feature. Model load measured `4.222 s`; forced inference plus persistence measured `0.087 s` in the build environment.

This is **local runtime verification**, not canonical VM verification, a model-quality benchmark, an ingest integration test, or product end-to-end proof. The build environment was x86_64 with 6 logical CPUs, roughly 3.8 GiB RAM, 32 GiB free disk, and no NVIDIA GPU.

## VM installation and operation

Use Python 3.12 and the CPU-only runtime requirements before installing the editable package:

```bash
cd /srv/ollamabinsaden
python3 -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r services/analysis/requirements-cpu.txt
python -m pip install -e 'services/analysis[runtime,test]'

export SORTER_ANALYSIS_MODEL_CACHE=/var/lib/sorter/models/torch
export SORTER_ANALYSIS_OUTPUT_ROOT=/srv/sorter/analysis
mkdir -p "$SORTER_ANALYSIS_MODEL_CACHE" "$SORTER_ANALYSIS_OUTPUT_ROOT"
python -c 'from analysis_service.backends import TorchvisionResNet18Backend; TorchvisionResNet18Backend(cache_dir="/var/lib/sorter/models/torch")'
```

Run a single worker first and measure memory, queue depth, model-cache permissions, corrupt/unsupported rates, and real-collection duration before increasing concurrency. The model cache and derived result/feature store are rebuildable derived data; canonical assets remain the durable source of truth.

## Unresolved risks and recommended next action

The profile registry, approved-revision registry, long-term terminal-result store, external feature payload store, transient job-status ownership, and Analysis-to-Search adapter remain architecture/integration decisions outside this surgical pass. The implementation’s JSON result history and current pointer satisfy the contract’s immutable terminal/history requirements but are not a final multi-process/storage decision.

The next owner should be the architect/reviewer for PR #7. Review this contract alignment against `docs/acceptance/VISUAL-ANALYSIS.md`; do not begin Analysis-to-Search integration until both aligned Analysis and Search work are accepted. After architect review, the canonical Azure/Linux VM must run a representative real ingest-produced asset and later participate in full index/Gallery end-to-end acceptance.

## References

[1]: <https://docs.pytorch.org/vision/stable/models.html> "TorchVision Models and Pre-trained Weights"


## Focused review correction update

PR #7 was converged with current `main` at `ac2394c8f3db9c52fdf834ca898612ca57e968aa` and its eight outstanding review findings were corrected in implementation commit `0858d0f72ac17dd45f6826164162bd381e0112c3`. The accepted logical/terminal identity split, immutable history, preferred pointer, hash fields, profile revisioning, classifier-only tags/categories, OCR semantics, CPU-first ResNet-18 runtime, and VisualFeature compatibility contract were preserved.

| Review finding | Focused correction and regression evidence |
|---|---|
| Asset-record acceptance | `AssetInput.from_asset_record()` now requires the accepted `asset-record` / version `1` shape, ready state, required locator fields, valid algorithm-qualified hashes, non-negative byte size, and `asset_id == content_hash`. Direct input construction retains the same identity invariant. |
| Exact-byte integrity | The service streams one opened canonical source into a private verified snapshot while calculating SHA-256; image decode, ResNet inference, and OCR use only that snapshot, which is removed in `finally`. A deterministic source-replacement regression proves the original verified bytes are analysed. |
| Image safety | Pillow decompression-bomb errors and warning-to-error paths are normalized through decode validation, ResNet image opening, and Tesseract image opening without globally weakening Pillow safety limits. |
| Explicit cache selection | An explicit `--model-cache` / configured cache temporarily overrides ambient `TORCH_HOME` while weights initialize, then restores the ambient process value. |
| Reusable execution | `--asset-records-jsonl` is the production-capable bounded batch mode. One process initializes TorchVision, ResNet weights, preprocessing, optional OCR, and `AnalysisService` once, then writes one compact normalized output per complete input line. |
| Cache eligibility | Compatible `ready` results reuse; a `partial` result carrying any retryable unresolved issue is retried on a later ordinary call while immutable history remains auditable. |
| Forced rerun history | The earlier overwrite concern remains resolved by immutable result files plus a separate preferred pointer. A new regression proves a forced failed rerun cannot displace a prior ready result. |
| Ingest filename | Analysis-owned documentation now uses `_ingest/records/<asset-digest>.json`, matching the ingest writer’s removal of the `sha256:` filename prefix. |

The full required gate passed after these changes: `ruff check`, repository-root `mypy services/analysis/src`, compilation, `git diff --check`, and **31 deterministic tests**. A post-correction real local CPU evaluation returned `ready`, a classifier-sourced `samoyed` tag at `0.884622`, empty classifier-only objects, matching expected/input hashes, a UUIDv4 terminal result ID, and a 512-dimensional L2 unit feature. Model initialization measured `4.163 s`; forced analysis plus persistence measured `0.108 s` on the build environment. These figures are local verification evidence, not canonical Azure VM throughput or product end-to-end acceptance.

All eight previously unresolved PR #7 review threads received commit/test evidence and were resolved. Canonical VM validation, real ingest-to-Analysis execution, Analysis-to-Search exact-result provenance integration, and product end-to-end acceptance remain separate gates.
