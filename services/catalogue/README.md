# Gallery local catalogue — first ingestion slice

A trusted local-operator CLI imports an explicitly selected directory into Gallery-owned
content-addressed blobs and SQLite metadata. It uses no Extract, MySQL, OAuth, Analysis,
Search, Ollama, network, or model runtime. Python 3.12 and a Unix filesystem are required.

```bash
# From the repository root; setup also installs this package.
uv pip install --python .venv/bin/python -e 'services/catalogue[test]'
.venv/bin/gallery-catalogue --state-root /approved/gallery-state --owner device-owner \
  import-local --source-root /approved/photos --source-id local-photos
.venv/bin/gallery-catalogue --state-root /approved/gallery-state --owner device-owner list --limit 50
```

Select only authorized collections. Keep state outside Git and outside the source tree.
The local CLI's owner parameter selects scope; it is **not authentication**. This CLI is
not a public API. Operators and filesystem permissions protect state; an HTTP adapter must
resolve ownership from signed Gallery sessions, never accept arbitrary client owner IDs or
source paths, and authorize media access before returning bytes or locators.

## Behavior

- Streams real bytes into owned storage; SHA-256 proves canonical identity. Identical bytes
  share one asset and preserve every source/path occurrence.
- Emits pinned `asset-record` and `source-occurrence-record` v1 records without changing the
  shared schemas. Asset storage locators are server-local absolute paths usable by Analysis.
- Stores sources scoped by owner and source ID; source IDs cannot silently change roots.
  Assets share storage, but catalogue listings return only the caller scope's occurrences.
- Re-import is idempotent. First-observed provenance stays unchanged. New bytes at an old
  path create a new asset/occurrence; historical records and stored bytes remain available.
- Lists canonical records in asset-ID order with `results` and nullable `next_cursor`.
  Each result contains `asset` and structurally associated `source_occurrences`. This is a
  catalogue envelope, not the Search result API. Limit is 1–200; use cursors for the same owner.
- Skips symlinks, linked directories, and special files with explicit `skipped_paths`.
  Read errors or detected mid-copy changes fail the import and roll back collection metadata.
  Unreferenced blobs may remain after failure and are reused on retry. Existing blobs are
  hash-verified on re-import; detected corruption fails rather than reporting a new ready asset.
- Copies rather than edits originals. MIME type is a filename-based hint, not verified content
  detection; the first imported hint is retained for a byte-identical canonical asset.

## Limits and handoff

This is a synchronous first slice, not milestone 1 completion. Source trees must be trusted
and stable during import: this is not a sandbox against concurrent malicious directory swaps.
Listing does not re-verify every blob; Analysis independently verifies canonical bytes before
inference. No source deletion reconciliation, quotas, resumable jobs, automatic orphan cleanup,
user annotation storage, Extract collection manifest importer, Drive ingestion, HTTP/media API,
or Expo UI wiring exists yet. Existing app fixtures/review state remain unchanged.

A persistent host needs durable, access-controlled storage for `catalogue.sqlite` and `blobs/`
together, backups, disk capacity for copied bytes, and authorized readable collection mounts.
Cloud tests prove temporary-host import/restart and fixture Analysis/Search interoperability,
not production persistence, real model inference, or native device behavior.

Next: expose authenticated paginated catalogue/media operations through Gallery's backend and
wire an explicit real-library UI mode while preserving review overrides and fixture evaluation.

## Checks

```bash
.venv/bin/python -m pytest services/catalogue/tests tests/integration
.venv/bin/ruff check services/catalogue
.venv/bin/mypy --strict services/catalogue/src
```

Tests validate both pinned schemas, duplicate/provenance semantics, process restart, owner
isolation, changed-source history, pagination, symlink/special-file skipping, rollback/retry,
corruption failure, CLI errors, and ingestion → fixture Analysis → visual Search.
