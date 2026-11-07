# Canonical Import Specification (`apps/gallery`)

## Overview

Gallery accepts canonical asset records and source occurrences produced by an approved canonicalization or Extract export process without minting client-side identities or dereferencing host filesystem paths.

## Accepted Input Formats

1. **Single Canonical Asset Record (`asset-record` v1)**:
   - Validated against `contracts/asset-record-v1.schema.json`.
   - `asset_id` and `content_hash` must both match `^sha256:[0-9a-f]{64}$` and be strictly equal.
   - `processing_state` must be `"ready"`.

2. **Canonical Import Envelope (`gallery-canonical-import` v1)**:
   - `schema: "gallery-canonical-import"`, `schema_version: 1`.
   - `assets`: Non-empty array of `AssetRecordV1` (`processing_state: "ready"`).
   - `occurrences`: Optional array of `SourceOccurrenceRecordV1` (`^occurrence:sha256:[0-9a-f]{64}$`) whose `asset_id` belongs to `assets`.
   - `metadata`: Optional array of bounded presentation metadata keyed by `asset_id`.

## Safety & Atomic Merge Rules

- **Size Limit:** Payloads larger than `MAX_IMPORT_BYTES` (10 MiB) are rejected before parsing.
- **Locator Safety:** Imported `storage_locator`, `source_location`, and `original_path` values are stored as provenance metadata only; the mobile client never opens host filesystem paths or remote `http(s)://` preview URLs.
- **All-or-Nothing Merge:** Any orphan occurrence, duplicate ID within a batch, occurrence ID reused across different assets, or conflicting canonical `size_bytes`/`mime_type`/`content_hash` aborts the entire import without mutating the prior snapshot.
- **Idempotence & Annotation Preservation:** Re-importing an existing asset preserves user annotations (`reviewState`, `userNotes`, `preferredSourceOccurrenceId`, and prior `previewDataUri` if no new data URI is supplied) while merging any newly observed `SourceOccurrenceRecordV1` entries.

