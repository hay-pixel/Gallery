# Analysis Service

`services/analysis` is the permanent local visual-analysis boundary for canonical assets. It accepts a ready ingest `asset-record-v1`, verifies the bytes at its authorised canonical locator before inference, and persists project-owned `analysis-record` v1 terminal results plus `visual-feature` v1 vectors. It does not use extractor paths as durable identity, call hosted inference for analysis, or require a development worker/runtime credential.

## CPU-first image-v1 runtime

The initial runtime remains a locally cached **TorchVision ResNet-18 ImageNet-1K v1** classifier with a 512-dimensional, L2-normalized pre-classifier vector. It is deliberately a small CPU-first baseline, not a claim of general captioning, object detection, or scene understanding. TorchVision publishes model-specific preprocessing with each weight and notes that deployers must assess applicable pretrained-weight terms.[1]

Whole-image classifier predictions become controlled `tags[]` and broad `categories[]`, both with `source: "classifier"`. They do **not** populate `objects[]`, because a classifier top-K score is not a grounded object-presence claim. This runtime does not identify people, perform face matching, or infer sensitive attributes.

| Component | Image-v1 behaviour |
|---|---|
| Byte verification | SHA-256 verification blocks inference unless the observed bytes equal `expected_content_hash`. |
| Classification | Local ResNet-18 classifier-sourced tags/categories and a cautious classifier-derived summary. |
| Visual feature | Inline, finite 512-dimensional `image_embedding`; L2 normalization and complete extractor revision are explicit. |
| OCR | Explicit `not_requested`, `ready`, `unsupported`, or `failed` result structure; local Tesseract is optional. |
| Object detection / captions / video | Not implemented. No object claim is fabricated from classifier output. |

## Persisted contract

The normative contract is [`docs/contracts/VISUAL-ANALYSIS.md`](../../docs/contracts/VISUAL-ANALYSIS.md), with feature requirements in [`docs/contracts/VISUAL-FEATURES.md`](../../docs/contracts/VISUAL-FEATURES.md). The table below identifies the image-v1 implementation semantics.

| Field or structure | Image-v1 semantics |
|---|---|
| `analysis_id` | Deterministic logical ID over canonical asset, `expected_content_hash`, schema, analysis profile/version, normalization revision, analyser, and versioned component semantics. |
| `result_id` | Fresh project-owned UUIDv4 for each immutable persisted terminal outcome. Retries share a logical `analysis_id` but never a `result_id`. |
| Hash fields | `expected_content_hash` is always the requested canonical hash. `input_content_hash` is null before inference and is set only when verified bytes are accepted for inference. A mismatch has null input hash plus optional differing `observed_content_hash`. |
| `analysis_profile` | Project-owned `profile_id`, **string** `profile_version`, and material `normalization_revision`, with requested component/revision metadata. |
| Status | `pending`, `processing`, `ready`, `partial`, `unsupported`, `failed`, or `stale`. The current synchronous worker persists terminal states; transient orchestration states are representable by the model. |
| `ocr` | Separate state/result object. Successful OCR records engine ID/version. OCR text is not silently copied into tags. |
| `visual_features[]` | Includes feature type/model/version, `feature_extractor_revision`, dimensions, `similarity_family`, normalization semantics, verified input hash, canonical asset ID, and exact analysis/result provenance. |

Records serialize empty lists and `null` optional values explicitly. Raw model responses, SDK objects, provider/build-worker IDs, credentials, and temporary callback URLs are excluded from the consumer contract.

## Immutable terminal history and preferred result

Each terminal outcome is atomically written under its logical analysis directory:

```text
<SORTER_ANALYSIS_OUTPUT_ROOT>/
  records/
    <asset-sha256-digest>/
      <analysis-id-digest>/
        <result-id-uuidv4>.json
  current/
    <asset-sha256-digest>/
      <analysis-id-digest>.json
```

Terminal record files are never overwritten by a forced run or retry. A distinct atomically updated `current` pointer selects the highest eligible current result for the exact current asset/profile/analyser identity, ranking `ready` above `partial` above `unsupported`, then timestamp and `result_id`. Failed/stale records remain auditable but are not returned as reusable current metadata.

## Installation and controlled cache priming

Use Python 3.12 on the VM. Install the CPU-only Torch pair before the editable package so the no-GPU path does not acquire CUDA runtime packages.

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

OCR is opt-in. If the VM has the `tesseract` executable and OCR is approved for the active profile, install `services/analysis[ocr]` and set `SORTER_ANALYSIS_OCR=tesseract`.

## Run

```bash
# The accepted ingest writer removes the `sha256:` prefix from the record filename.
ollamabinsaden-analysis \
  --asset-record /srv/sorter/output/_ingest/records/<asset-digest>.json \
  --output-root "$SORTER_ANALYSIS_OUTPUT_ROOT" \
  --model-cache "$SORTER_ANALYSIS_MODEL_CACHE" \
  --pretty
```

For normal bulk work, start one process with a newline-delimited manifest of complete accepted asset-record JSON objects. The process initializes TorchVision, ResNet-18 weights, preprocessing, and optional OCR once, then reuses those objects for every line rather than loading a model per asset.

```bash
ollamabinsaden-analysis \
  --asset-records-jsonl /srv/sorter/output/_ingest/ready-assets.jsonl \
  --output-root "$SORTER_ANALYSIS_OUTPUT_ROOT" \
  --model-cache "$SORTER_ANALYSIS_MODEL_CACHE"
```

Batch output is one compact normalized JSON record per input line. A malformed input line is emitted as a bounded `input_error` record and does not terminate later valid lines. The process exits `0` only when all handled results are `ready`, `partial`, or `unsupported`; it exits `1` for input errors, `failed`, or `stale` results. It never fetches arbitrary locator schemes.

The service streams the one opened canonical source into a private verified snapshot while calculating its hash; decode validation, classifier inference, and optional OCR consume that snapshot rather than reopening the mutable canonical path. Pillow decompression-bomb failures are normalized as media failures without disabling the safety limit. A compatible `ready` record is reusable, while a `partial` record with a retryable unresolved component is rerun on the next normal attempt and remains immutable in history. The reusable `scripts/evaluate_runtime.py` reports aligned analysis/result IDs, hash fields, classifier tags/categories, and feature dimensions for an operator-supplied local image.

## Verification scope and limitations

The pre-alignment build environment measured 6 x86_64 vCPUs, approximately 3.8 GiB RAM, 32 GiB free disk, and no NVIDIA GPU. A prior CPU-only local ResNet run produced a normalized `samoyed` classifier tag with a 512-dimensional unit-normalized vector. That is build-environment runtime evidence only; canonical Azure VM verification, real ingest-to-analysis integration, Search indexing, and full real-archive acceptance remain separate gates.

Future captioning, detector, OCR-engine, and sampled-video components must enter behind the same profile/version and immutable-result boundaries. Video must retain parent canonical asset identity, parent hash semantics, and explicit frame/video feature scope; it must not change the image-v1 data model.

## References

[1]: <https://docs.pytorch.org/vision/stable/models.html> "TorchVision Models and Pre-trained Weights"
