# Runtime repair checkpoint — 2026-11-11

Based on origin/main d6fc270, isolated on repair/gallery-runtime. No merge, push, AWS change,
or deployment was performed. This is a targeted repair, not a completed product redesign.

## Reproduced baseline

- Sources' JSON import button only reloaded cache; it never opened a picker.
- Drive used the obsolete template login entry rather than googleDrive.beginConnect.
- Local browsing claimed granted access without calling any permission adapter.
- Image cards/grid ignored validated previewDataUri metadata and showed icons only.
- Horizontal filters expanded vertically (277 px on a cold Images route at 390×844).
- Canonical JSON parsing required Node Buffer, absent from browser/native runtimes.
- Offline Ask used FIXTURE_FILES regardless of the actual imported catalogue.
- Python tests: 99 passed. TypeScript failed on assigning readonly NODE_ENV in a test.
  App tests: 68 passed, 3 suites failed during native-module initialization in Node.

## Repairs

- Wire the real Expo document picker, selected-file reading, existing validation and atomic
  catalogue merge. Show busy, success and error states; cancellation preserves existing state.
- Restore the dedicated signed-session Drive authorization path with approved web/native
  return URI handling. Surface backend/OAuth errors; a successful consent flow remains unverified.
- Label cached catalogue/sample data honestly and report unconnected media discovery as
  unavailable. Automatic device media discovery itself is not implemented by this patch.
- Render bounded imported image data URIs in cards and the Images grid. Never dereference
  imported server paths or arbitrary remote preview URLs.
- Bound horizontal filter strips, center contents and keep 44-pixel touch targets.
- Replace Buffer byte counting with runtime-independent UTF-8 counting; keep the 10 MiB limit.
- Use only current catalogue views for offline Ask, labelled local text matches with no AI claim.
- Isolate OS storage/deep links/safe-area boundaries in Node SSR tests; use vi.stubEnv for the
  existing production-mode test. Real routes are exercised separately by browser smoke checks.

## Evidence and next work

Verification: 99 Python tests and 84 app tests pass; TypeScript passes; ESLint reports zero errors and seven existing warnings. The Node server build and production web export pass. Browser checks pass for import, persistence, invalid input, previews, Drive request wiring, and offline Ask. Reproducible
browser checks and setup instructions are in tests/browser/README.md. Browser import checks
cover valid/invalid selections, persistence, preview display, Drive request wiring, offline
Ask, and unavailable discovery. Layout checks cover Images, Library and Search at 390×844.

The present first-run sample seed and technical/metadata-heavy screen copy still need a
product design decision. Real server catalogue synchronization, Drive source/file presentation,
actual local media discovery and a coherent visual redesign remain separate unfinished work.
Do not equate imported JSON metadata with media bytes uploaded/verified by the backend.

AWS credentials and Google OAuth are absent in this Cloud workspace; successful live consent,
backend data integration, real model inference, native picker/deep-link behavior and physical
device usability have not been verified. The document-picker module needs a fresh native build.
