# Gallery Selective PR #20 Port Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover PR #20's proven local-source, canonical-import, offline-cache, mobile UX, and degradation behavior in standalone Gallery without regressing current identity, Search, Ollama, Analysis, or security contracts.

**Architecture:** Persist canonical assets, source occurrences, Analysis consumer views, Gallery annotations, and discovered sources as separate normalized collections joined into immutable UI views by `asset_id`. Keep local catalogue browse distinct from server-mediated Search, and keep all Ollama host/credential/raw-wire concerns behind Gallery's backend with a typed unavailable default.

**Tech Stack:** Expo 54, React Native 0.81, TypeScript 5.9, React 19, Expo Router, tRPC 11, Vitest, Zod, Python 3.12, pytest, Limrun remote Gradle and Android emulator.

**Spec:** `docs/superpowers/specs/2026-10-06-gallery-selective-pr20-port-design.md`

## Global Constraints

- Target only `hay-pixel/Gallery`; start from current standalone `origin/main` and never merge/cherry-pick historical PR #20.
- Historical evidence is `hay-pixel/Ollamabinsaden` commit `2ab68bab8fe7b26d4f824260de29b24e8c4b3d8e`.
- Durable asset identity is only `sha256:<64 lowercase hex>` `asset_id`; asset-record v1 `content_hash` must equal `asset_id`.
- Preserve every source occurrence for identical canonical bytes.
- Discovered source items are source-only until an approved import/canonicalization result supplies an `asset_id`.
- Never dereference imported Extract filesystem locators from the mobile client.
- Basic catalogue browse works without Search indexes, Analysis, or Ollama.
- Mobile code never implements metadata/semantic/visual/hybrid indexes and never relabels lexical browse as Search provenance.
- Browser/Android clients never receive or store a raw Ollama host, port, token, or raw API payload.
- Raw Ollama `11434` stays private; Gallery's backend consumes project-facing Ollama operations.
- Ollama is optional and never gates ordinary browse or deterministic Search.
- Gallery annotations never mutate canonical asset, source occurrence, or Analysis records.
- Preserve the existing read-only Google Drive behavior and signed Gallery session boundary.
- Use TDD for every behavior change: watch the focused test fail for the intended reason before implementation, then pass it and the stage suite.
- Keep the inherited five lint warnings classified as baseline; add zero unexplained warnings and zero errors.
- Version the accepted Android candidate as `1.1.0` / versionCode `6` unless the reviewed spec is revised before execution.
- One coherent branch/PR: `feat/gallery-selective-pr20-port`.

## Review Focus

- A malicious import containing a valid-looking asset with orphan/duplicate/conflicting occurrences must fail atomically without changing the previous snapshot; Task 3 tests this.
- A URI/provider ID/path that resembles a hash must remain source-only until accepted canonical records arrive; Tasks 2 and 5 test this.
- Search unavailable, stale, and zero-result states must remain distinguishable and lexical browse must never claim semantic/visual/hybrid provenance; Task 6 tests this.
- A configured or malicious client must not learn/send a raw Ollama host/token or call `11434`; Task 7 tests source, config, and runtime boundaries.
- A cache write interruption, process restart, or reimport must preserve the last complete canonical records, occurrences, and Gallery annotations; Tasks 3–4 and Task 10 test this.

---

### Task 1: Create the isolated branch and freeze the baseline

**Files:**

- Read: `AGENTS.md`
- Read: `README.md`
- Read: `docs/MIGRATION.md`
- Read: `docs/contracts/{SEARCH,QUERY,OLLAMA,VISUAL-ANALYSIS,VISUAL-FEATURES}.md`
- Read: `contracts/{asset-record-v1.schema.json,source-occurrence-record-v1.schema.json,source.json}`
- Read: `deploy/aws/README.md`
- No product file modifications.

**Interfaces:**

- Consumes: standalone `origin/main` and this specification/plan.
- Produces: isolated worktree on `feat/gallery-selective-pr20-port`, a recorded base SHA, and green baseline logs.

- [ ] **Step 1: Verify the source checkout and worktree state**

  Run from `/home/azureuser/repo/Gallery`:

  ```bash
  git fetch origin main
  git status --short --branch
  git rev-parse origin/main
  git worktree list --porcelain
  ```

  Expected: `origin/main` resolves; only known local `.codex/` state may be untracked; no existing branch/worktree owns `feat/gallery-selective-pr20-port`.

- [ ] **Step 2: Create an ignored isolated worktree**

  Use the platform-native worktree tool when available. Otherwise verify `.worktrees/` is ignored and create `.worktrees/gallery-selective-pr20-port` on `feat/gallery-selective-pr20-port` from `origin/main`.

  Expected: linked worktree has a clean status on the named branch; original checkout remains unchanged.

- [ ] **Step 3: Run setup and record exact versions**

  Run:

  ```bash
  bash scripts/codex/environment.sh setup
  node --version
  (cd apps/gallery && corepack pnpm --version)
  .venv/bin/python --version
  ```

  Expected: setup exits 0; Node is 22+, pnpm is 9.12.0 inside the app, Python is 3.12.

- [ ] **Step 4: Run the complete baseline**

  Run:

  ```bash
  bash scripts/codex/environment.sh test
  bash scripts/codex/environment.sh build
  ```

  Expected: at least 73 Python tests and 22 app tests pass, TypeScript passes, lint has zero errors and the documented five warnings, server build exits 0.

- [ ] **Step 5: Record the baseline without changing product code**

  Add the base SHA and test counts to the task ledger. Do not commit generated dependencies, `.venv`, `.codex`, build output, or logs.

**Completion/stop:** Stop if `origin/main` moved in a way that changes the contract or baseline, or if any baseline command fails. Diagnose before Task 2.

---

### Task 2: Define the normalized catalogue domain

**Files:**

- Create: `apps/gallery/lib/catalogue/contracts.ts`
- Create: `apps/gallery/lib/catalogue/types.ts`
- Create: `apps/gallery/lib/catalogue/view-model.ts`
- Create: `apps/gallery/lib/catalogue/annotations.ts`
- Create: `apps/gallery/lib/catalogue/fixture-adapter.ts`
- Modify: `apps/gallery/lib/pixeldrive.ts`
- Create: `apps/gallery/tests/gallery-catalogue.test.ts`
- Preserve: `contracts/*.schema.json`

**Historical references:** PR #20 `lib/gallery/assets.ts`, `lib/gallery/sources.ts`, `tests/gallery-domain.test.ts`.

**Interfaces:**

- Produces:
  - `parseAssetRecordV1(input: unknown): AssetRecordV1`
  - `parseSourceOccurrenceRecordV1(input: unknown): SourceOccurrenceRecordV1`
  - `GalleryCatalogueSnapshotV1`
  - `GalleryAnnotations`
  - `DiscoveredSourceItem` without durable `asset_id`
  - `buildCatalogueAssetView(assetId: AssetId, snapshot: GalleryCatalogueSnapshotV1): CatalogueAssetView`
  - `snapshotFromFixtures(enabled: boolean): GalleryCatalogueSnapshotV1`
- Consumes: pinned v1 schemas and existing `FileRecord` fixtures.

- [ ] **Step 1: Write failing contract-validation tests**

  In `gallery-catalogue.test.ts`, add cases named:

  - `accepts asset-record v1 only when asset_id equals content_hash`
  - `rejects paths provider ids and ui ids as asset identity`
  - `accepts multiple source occurrences for one canonical asset`
  - `rejects orphan source occurrences when assembling a view`

  Assert exact accepted/rejected shapes from the pinned schemas.

- [ ] **Step 2: Run the focused tests and verify RED**

  Run:

  ```bash
  corepack pnpm --dir apps/gallery test -- tests/gallery-catalogue.test.ts
  ```

  Expected: FAIL because the new catalogue modules do not exist.

- [ ] **Step 3: Implement pinned contract parsers**

  Implement exact v1 field types and Zod parsers in `contracts.ts`. Do not add `@ollamabinsaden/contracts`; the standalone repository owns pinned JSON snapshots. Enforce lowercase SHA-256 identity and equality of `asset_id`/`content_hash`.

- [ ] **Step 4: Implement normalized snapshot and view types**

  In `types.ts`, keep `canonical_assets`, `source_occurrences`, `analysis_views`, `annotations`, `discovered_sources`, and `capability_state` separate. In `view-model.ts`, join by `asset_id` and clone arrays/objects so callers cannot mutate persisted records.

- [ ] **Step 5: Run contract tests and verify GREEN**

  Expected: all new identity, occurrence, and orphan tests pass.

- [ ] **Step 6: Write failing fixture/annotation tests**

  Add cases:

  - `sample catalogue is empty unless explicitly enabled`
  - `exact duplicate fixtures become one asset with multiple occurrences`
  - `Gallery annotations do not change canonical or source records`
  - `classifier tags are not exposed as detected objects`

  Expected RED: fixture adapter/annotation helpers are missing.

- [ ] **Step 7: Implement fixture and annotation adapters minimally**

  Move only reusable fixture-to-catalogue behavior out of `pixeldrive.ts`. Keep compatibility exports for current screens until Task 8. Do not make fixtures a production repository.

- [ ] **Step 8: Verify the stage suite**

  Run:

  ```bash
  corepack pnpm --dir apps/gallery test -- tests/gallery-catalogue.test.ts tests/pixeldrive.logic.test.ts
  corepack pnpm --dir apps/gallery check
  ```

  Expected: PASS with no TypeScript errors.

- [ ] **Step 9: Commit**

  ```bash
  git add apps/gallery/lib/catalogue apps/gallery/lib/pixeldrive.ts apps/gallery/tests/gallery-catalogue.test.ts
  git commit -m "feat(gallery): define canonical catalogue domain"
  ```

**Completion/stop:** No later task may invent another canonical asset type. Stop if current fixture behavior cannot be represented without weakening the accepted identity contract.

---

### Task 3: Port canonical import and atomic merge

**Files:**

- Create: `apps/gallery/lib/catalogue/import.ts`
- Create: `apps/gallery/lib/catalogue/merge.ts`
- Create: `apps/gallery/lib/catalogue/pick-import.ts`
- Create: `apps/gallery/tests/gallery-canonical-import.test.ts`
- Create: `apps/gallery/docs/CANONICAL-IMPORT.md`

**Historical references:** PR #20 files with the same roles.

**Interfaces:**

- Consumes: Task 2 `AssetRecordV1`, `SourceOccurrenceRecordV1`, snapshot, annotations.
- Produces:
  - `parseCanonicalImport(text: string): CanonicalImportBatch`
  - `mergeCanonicalImport(snapshot: GalleryCatalogueSnapshotV1, batch: CanonicalImportBatch, now: string): GalleryCatalogueSnapshotV1`
  - `pickCanonicalImport(adapter?: CanonicalImportPicker): Promise<CanonicalImportBatch | null>`
  - `MAX_IMPORT_BYTES = 10 * 1024 * 1024`

- [ ] **Step 1: Write failing import-format tests**

  Port/adapt test cases for single asset record, bounded bundle, invalid JSON, too-large input, unsupported schema version, failed processing state, hash mismatch, negative size, duplicate asset IDs, duplicate occurrence IDs, orphan occurrences, and duplicate metadata.

- [ ] **Step 2: Verify RED**

  Run the single test file; expect module-not-found/function-not-found failure.

- [ ] **Step 3: Implement bounded parsing**

  Accept the two forms in the spec. Return normalized records; do not create the UI view model in the parser. Treat metadata as bounded presentation input only. Reject filesystem/HTTP preview URLs and never read `storage_locator`.

- [ ] **Step 4: Verify parsing GREEN**

  Expected: all parser tests pass, including malicious/orphan cases.

- [ ] **Step 5: Write failing atomic-merge tests**

  Add exact tests for:

  - idempotent reimport;
  - preserving annotations, notes, preferred occurrence, and prior preview when new preview is absent;
  - merging new occurrences for the same asset;
  - rejecting an occurrence reused by another asset;
  - rejecting canonical size/MIME/hash conflicts without mutating input snapshot;
  - deterministic output ordering.

- [ ] **Step 6: Implement atomic merge**

  Validate the entire batch and construct a new snapshot before returning it. Never mutate the input. Key canonical assets by `asset_id` and occurrences by `source_occurrence_id`.

- [ ] **Step 7: Write and implement picker tests**

  Test cancellation, non-JSON selection, bounded UTF-8 read, and parse-before-merge. Implement an injected adapter so Vitest never opens a real picker.

- [ ] **Step 8: Verify the stage suite**

  ```bash
  corepack pnpm --dir apps/gallery test -- tests/gallery-canonical-import.test.ts tests/gallery-catalogue.test.ts
  corepack pnpm --dir apps/gallery check
  ```

  Expected: PASS.

- [ ] **Step 9: Document and commit**

  Document accepted formats, limits, locator safety, occurrence semantics, and Gallery annotations.

  ```bash
  git add apps/gallery/lib/catalogue apps/gallery/tests/gallery-canonical-import.test.ts apps/gallery/docs/CANONICAL-IMPORT.md
  git commit -m "feat(gallery): import canonical assets atomically"
  ```

**Completion/stop:** Stop on any non-atomic failure path or any code that dereferences imported storage/source paths.

---

### Task 4: Port durable offline cache behavior

**Files:**

- Create: `apps/gallery/lib/catalogue/cache-store.ts`
- Create: `apps/gallery/lib/catalogue/device-cache.ts`
- Create: `apps/gallery/tests/gallery-cache.test.ts`
- Modify: `apps/gallery/package.json`
- Modify: `apps/gallery/pnpm-lock.yaml`

**Historical references:** PR #20 `cache-storage.ts`, `device-cache.ts`, cache section of `gallery-canonical-import.test.ts`.

**Interfaces:**

- Consumes: Task 2 snapshot; Task 3 import/merge output.
- Produces:
  - `CacheIO` with pointer/slot/legacy operations
  - `createGalleryCacheStore(io: CacheIO): { read(): Promise<GalleryCatalogueSnapshotV1 | null>; write(snapshot): Promise<void> }`
  - `galleryDeviceCache`

- [ ] **Step 1: Write failing two-slot and restart tests**

  Port the 20,000-source restart, failed slot write, failed pointer update, concurrent serialized writes, and legacy read tests. Add corrupt-pointer and unsupported-schema cases.

- [ ] **Step 2: Verify RED**

  Run `gallery-cache.test.ts`; expect missing implementation.

- [ ] **Step 3: Implement pure two-slot cache**

  Serialize writes in call order, write the inactive slot completely, then update the pointer. A failed slot or pointer write must leave the previously committed slot readable.

- [ ] **Step 4: Verify pure cache GREEN**

  Expected: memory-adapter tests pass, including 20,000 records and restart construction.

- [ ] **Step 5: Add Expo filesystem dependency and injected device adapter tests**

  Add only the Expo 54-compatible filesystem package/API required by the adapter. Test path selection, no secret logging, and safe legacy migration with an injected filesystem.

- [ ] **Step 6: Implement device cache adapter**

  Store cache under app-owned storage. Do not store source bytes, OAuth credentials, Ollama credentials, or imported external locators as files.

- [ ] **Step 7: Verify stage and lockfile**

  ```bash
  corepack pnpm --dir apps/gallery install --frozen-lockfile
  corepack pnpm --dir apps/gallery test -- tests/gallery-cache.test.ts tests/gallery-canonical-import.test.ts
  corepack pnpm --dir apps/gallery check
  ```

  Expected: PASS; lockfile is standalone-generated.

- [ ] **Step 8: Commit**

  ```bash
  git add apps/gallery/lib/catalogue apps/gallery/tests/gallery-cache.test.ts apps/gallery/package.json apps/gallery/pnpm-lock.yaml
  git commit -m "feat(gallery): persist catalogue cache safely"
  ```

**Completion/stop:** Do not integrate UI hydration until restart tests prove last-complete-snapshot behavior.

---

### Task 5: Port native sources, secure Gallery sessions, and launchers

**Files:**

- Create: `apps/gallery/lib/sources/types.ts`
- Create: `apps/gallery/lib/sources/native.ts`
- Create: `apps/gallery/lib/session/gallery-session-store.ts`
- Create: `apps/gallery/lib/launcher/companion.ts`
- Modify: `apps/gallery/lib/gallery-session.ts` to delegate or remove after callers migrate
- Modify: `apps/gallery/package.json`
- Modify: `apps/gallery/pnpm-lock.yaml`
- Modify: `apps/gallery/app.config.ts`
- Create: `apps/gallery/tests/gallery-native-sources.test.ts`
- Create: `apps/gallery/tests/gallery-session-store.test.ts`
- Create: `apps/gallery/tests/gallery-launcher.test.ts`

**Historical references:** PR #20 source/session/launcher modules and tests.

**Interfaces:**

- Produces:
  - `discoverLocalMediaSources(adapter, after?): Promise<SourceDiscoveryPage>`
  - `pickDocumentSources(adapter): Promise<SourceDiscoveryPage>`
  - `DiscoveredSourceItem` with `discoveryHandle`, no durable `asset_id`
  - `createGallerySessionStore(storage, approvedApiOrigin)`
  - `deriveCompanionState(probe): CompanionStatus`
  - `openCompanion(target, linking): Promise<CompanionStatus>`

- [ ] **Step 1: Write failing native-source tests**

  Preserve PR #20's five test classes and add:

  - provider cursor identical to previous cursor stops pagination;
  - source URI/provider ID never appears as `asset_id`;
  - restarted source metadata with revoked access reports revoked/unavailable rather than pretending access;
  - picker cancellation returns no error and no items.

- [ ] **Step 2: Verify RED and implement source-only adapters**

  Use injected Expo adapters. Request read access only; do not copy originals to cache as canonical content.

- [ ] **Step 3: Write failing session tests**

  Preserve restart persistence, per-approved-origin isolation, safe storage keys, no token/URL in key names, no session before configuration, and unsafe/credentialed URL rejection.

- [ ] **Step 4: Implement configured-origin session store**

  The only allowed origin comes from Gallery API configuration. Native secure storage may protect the signed session; web follows browser-appropriate storage. Do not accept arbitrary runtime origins from the user.

- [ ] **Step 5: Write failing launcher tests and implement minimal launcher**

  Test optional Extract/Assist schemes, missing app, installed-unconfigured, incompatible, ready, and launch failure. Launcher status must not depend on Search/Ollama.

- [ ] **Step 6: Add native dependencies and minimum permissions**

  Add Expo media-library/document-picker/secure-store packages at SDK-compatible versions. Configure read permissions and owned schemes. Do not enable global Android cleartext traffic.

- [ ] **Step 7: Verify public Expo config and stage tests**

  ```bash
  corepack pnpm --dir apps/gallery test -- tests/gallery-native-sources.test.ts tests/gallery-session-store.test.ts tests/gallery-launcher.test.ts tests/session-ownership.test.ts
  corepack pnpm --dir apps/gallery check
  corepack pnpm --dir apps/gallery exec expo config --type public
  ```

  Expected: tests pass; config contains only required read permissions; no public credential or Ollama host.

- [ ] **Step 8: Commit**

  ```bash
  git add apps/gallery/lib/sources apps/gallery/lib/session apps/gallery/lib/launcher apps/gallery/lib/gallery-session.ts apps/gallery/tests apps/gallery/package.json apps/gallery/pnpm-lock.yaml apps/gallery/app.config.ts
  git commit -m "feat(gallery): discover local sources safely"
  ```

**Completion/stop:** Stop if Android requires write access, source bytes are copied as canonical content, or volatile handles become durable identity.

---

### Task 6: Add local catalogue browse and server Search boundary

**Files:**

- Create: `apps/gallery/lib/catalogue/browse.ts`
- Create: `apps/gallery/lib/search/types.ts`
- Create: `apps/gallery/server/search-gateway.ts`
- Modify: `apps/gallery/server/routers.ts`
- Modify: `apps/gallery/lib/trpc.ts` only if generated/inferred client wiring requires it
- Create: `apps/gallery/tests/gallery-browse.test.ts`
- Create: `apps/gallery/tests/gallery-search-boundary.test.ts`

**Historical references:** PR #20 `lib/gallery/search.ts`, Search tests in domain/import suites.

**Interfaces:**

- Consumes: `CatalogueAssetView`, accepted Search/Query contracts.
- Produces:
  - `browseCatalogue(assets, query, filters, sort): CatalogueAssetView[]`
  - `SearchAvailability = ready | unavailable | stale | incompatible | failed`
  - provider-independent `SearchResult` with canonical `asset_id`, `content_hash`, retrieval mode, relationship, provenance, and components
  - `SearchPage<T> = { state; results; next_cursor }`
  - `SearchGateway` methods `searchMetadata`, `searchSemantic`, `findVisuallySimilar`, `searchHybrid`, `getSearchState`
  - `UnavailableSearchGateway`

- [ ] **Step 1: Write failing browse tests**

  Test canonical title/MIME/source/tag/annotation filtering, deterministic order, empty query behavior, and returned view immutability. Assert that browse results contain no Search retrieval mode/index/score.

- [ ] **Step 2: Verify RED and implement browse**

  Reuse PR #20 lexical intent without its fabricated Search provenance. Name and document this as in-memory catalogue browse.

- [ ] **Step 3: Write failing Search boundary tests**

  Test:

  - ready empty page is a no-match, not unavailable;
  - unavailable/stale/incompatible/failed are distinct;
  - cursor is nullable/opaque;
  - every result uses canonical asset/content hash;
  - visual results use `visually_similar` or `near_duplicate_candidate`, never exact duplicate without byte proof;
  - semantic/visual/hybrid requests cannot fall back to lexical results labelled with the requested mode;
  - unavailable gateway performs no network call.

- [ ] **Step 4: Implement types and unavailable gateway**

  Match contract wire semantics. Do not expose SQLite/vector row IDs or Python implementation types.

- [ ] **Step 5: Add tRPC gateway routes**

  Inject the server gateway; default to unavailable until an accepted transport is configured. Validate inputs with bounded query length, limit, filters, and cursor.

- [ ] **Step 6: Verify TypeScript and Python contract suites**

  ```bash
  corepack pnpm --dir apps/gallery test -- tests/gallery-browse.test.ts tests/gallery-search-boundary.test.ts tests/pixeldrive.logic.test.ts
  .venv/bin/python -m pytest services/search/tests tests/integration/test_analysis_search.py
  corepack pnpm --dir apps/gallery check
  ```

  Expected: all pass; Python Search remains unchanged unless a test-only compatibility correction is required and separately reviewed.

- [ ] **Step 7: Commit**

  ```bash
  git add apps/gallery/lib/catalogue/browse.ts apps/gallery/lib/search apps/gallery/server/search-gateway.ts apps/gallery/server/routers.ts apps/gallery/lib/trpc.ts apps/gallery/tests/gallery-browse.test.ts apps/gallery/tests/gallery-search-boundary.test.ts
  git commit -m "feat(gallery): separate browse from Search services"
  ```

**Completion/stop:** Stop if implementation requires a client index, raw vector, invented Search transport, or false retrieval provenance.

---

### Task 7: Add the private Ollama consumer boundary

**Files:**

- Create: `apps/gallery/lib/ollama/types.ts`
- Create: `apps/gallery/server/ollama-gateway.ts`
- Modify: `apps/gallery/server/routers.ts`
- Modify: `apps/gallery/.env.example`
- Create: `apps/gallery/tests/gallery-ollama-boundary.test.ts`
- Modify: `apps/gallery/tests/runtime-independence.test.ts`

**Historical references:** PR #20 `ask.ts`, `ollama-errors.ts`, settings behavior and tests. Do not copy `ollama-runtime.ts`, `secure-settings.ts`, or raw settings store.

**Interfaces:**

- Consumes: Task 6 Search/lookup evidence and accepted Ollama/Query contracts.
- Produces:
  - client-safe `OllamaHealth`, `OllamaModel`, `OllamaCapability`, `OllamaAvailability`, `GroundedAnswer`
  - server-only `OllamaGateway.health/models/capabilities/answerWithGrounding`
  - `UnavailableOllamaGateway`
  - tRPC operations exposing no host/token/raw payload

- [ ] **Step 1: Write failing source-boundary tests**

  Scan client production code/config for `11434`, `/api/tags`, `/api/show`, `/api/generate`, raw endpoint fields, auth token fields, and `EXPO_PUBLIC_*OLLAMA*`. Assert none exists after implementation.

- [ ] **Step 2: Write failing gateway behavior tests**

  Preserve behavioral intent for disabled/unavailable, missing model, unsupported capability, timeout, malformed/empty answer, no evidence means no call, exact canonical citations, limitations, and server-only error mapping.

- [ ] **Step 3: Verify RED**

  Expected: missing gateway/types and current absence of routes cause failures.

- [ ] **Step 4: Implement client-safe types and unavailable gateway**

  Do not invent the `services/ollama` transport. The default answers typed unavailable and returns no model host details.

- [ ] **Step 5: Add bounded tRPC operations**

  Validate model IDs/questions/result limits; accept only server-grounded canonical evidence. Do not accept a client-supplied runtime URL or token.

- [ ] **Step 6: Update environment example**

  Remove public Ollama configuration concepts. If documenting future server configuration, name it as a private project-facing adapter setting, not a raw client field, and never include a secret value.

- [ ] **Step 7: Verify stage**

  ```bash
  corepack pnpm --dir apps/gallery test -- tests/gallery-ollama-boundary.test.ts tests/runtime-independence.test.ts
  corepack pnpm --dir apps/gallery check
  ```

  Expected: PASS; source scan proves the client cannot configure/call raw Ollama.

- [ ] **Step 8: Commit**

  ```bash
  git add apps/gallery/lib/ollama apps/gallery/server/ollama-gateway.ts apps/gallery/server/routers.ts apps/gallery/.env.example apps/gallery/tests/gallery-ollama-boundary.test.ts apps/gallery/tests/runtime-independence.test.ts
  git commit -m "feat(gallery): add private Ollama boundary"
  ```

**Completion/stop:** Full Ollama runtime implementation is outside this plan. Stop rather than inventing its wire format or moving credentials/host configuration into the client.

---

### Task 8: Rebuild the mobile UI through focused routes and components

**Files:**

- Modify: `apps/gallery/app/(tabs)/_layout.tsx`
- Modify: `apps/gallery/app/(tabs)/index.tsx`
- Create: `apps/gallery/app/(tabs)/images.tsx`
- Create: `apps/gallery/app/(tabs)/search.tsx`
- Create: `apps/gallery/app/(tabs)/library.tsx`
- Create: `apps/gallery/app/(tabs)/sources.tsx`
- Create: `apps/gallery/app/(tabs)/settings.tsx`
- Create: `apps/gallery/features/catalogue/catalogue-provider.tsx`
- Create: `apps/gallery/features/home/home-screen.tsx`
- Create: `apps/gallery/features/images/images-screen.tsx`
- Create: `apps/gallery/features/library/library-screen.tsx`
- Create: `apps/gallery/features/search/search-screen.tsx`
- Create: `apps/gallery/features/sources/sources-screen.tsx`
- Create: `apps/gallery/features/sources/local-source-browser.tsx`
- Create: `apps/gallery/features/settings/settings-screen.tsx`
- Create: `apps/gallery/features/settings/ollama-settings-screen.tsx`
- Create: `apps/gallery/components/catalogue/asset-card.tsx`
- Create: `apps/gallery/components/catalogue/asset-detail-sheet.tsx`
- Create: `apps/gallery/components/capability-banner.tsx`
- Create: `apps/gallery/tests/gallery-navigation.test.tsx`
- Create: `apps/gallery/tests/gallery-sources-ui.test.tsx`
- Create: `apps/gallery/tests/gallery-degraded-ui.test.tsx`
- Modify: package/lockfile only for justified React Native test utilities.

**Historical references:** PR #20 `index.tsx`, `local-source-browser.tsx`, `ollama-settings.tsx`.

**Interfaces:**

- Consumes: Tasks 2–7 domain, cache, source, Search, and Ollama interfaces.
- Produces: thin routes and focused screens with no direct persistence/raw service logic.

- [ ] **Step 1: Add UI test harness and failing navigation tests**

  Test visible Home, Images, Search, Library, Sources, Settings destinations; tab selection; Android back behavior; empty catalogue; and safe-area render. Use accessible labels/text rather than implementation selectors.

- [ ] **Step 2: Implement tab layout and thin route shells**

  Each route only renders its feature screen. Preserve existing Drive OAuth return route outside the tabs.

- [ ] **Step 3: Verify navigation GREEN**

  Run the navigation test file and TypeScript.

- [ ] **Step 4: Write failing provider/hydration tests**

  Test initial loading, empty state, cache restore, atomic update persistence, import success/failure, and persistence errors without losing the in-memory last good snapshot.

- [ ] **Step 5: Implement catalogue provider**

  Provider coordinates Task 4 cache and selectors. It does not validate raw contracts or render screen policy.

- [ ] **Step 6: Write failing source UI tests**

  Test permission denied/limited/granted, paging, picker cancel, import error/success, source-only labels, Drive read-only state, and two-occurrence detail display.

- [ ] **Step 7: Implement Sources and local browser UI**

  Preserve useful PR #20 preview and source wording while keeping source-only versus canonical status explicit.

- [ ] **Step 8: Write failing browse/degradation UI tests**

  Test Home/Images previews, Library filters, Search no-match versus unavailable/stale, Ollama unavailable/model-unavailable, and missing companion state. Assert no endpoint/token input exists.

- [ ] **Step 9: Implement focused feature screens and shared components**

  Use `CatalogueAssetView`, local browse, and backend tRPC envelopes only. Preserve current read-only Drive media/detail behavior. Do not copy the historical 3,130-line component.

- [ ] **Step 10: Verify UI stage**

  ```bash
  corepack pnpm --dir apps/gallery test -- tests/gallery-navigation.test.tsx tests/gallery-sources-ui.test.tsx tests/gallery-degraded-ui.test.tsx
  corepack pnpm --dir apps/gallery check
  corepack pnpm --dir apps/gallery exec eslint .
  ```

  Expected: all UI tests and TypeScript pass; lint has zero errors and no unexplained new warnings.

- [ ] **Step 11: Run the complete app suite**

  ```bash
  corepack pnpm --dir apps/gallery test
  ```

  Expected: all old and new tests pass.

- [ ] **Step 12: Commit**

  ```bash
  git add apps/gallery/app apps/gallery/features apps/gallery/components apps/gallery/tests apps/gallery/package.json apps/gallery/pnpm-lock.yaml
  git commit -m "feat(gallery): add focused mobile catalogue flows"
  ```

**Completion/stop:** Stop and split a component before commit if a route owns persistence/network/domain logic or the design collapses back into a monolithic screen.

---

### Task 9: Finalize Android configuration and build the exact candidate

**Files:**

- Modify: `apps/gallery/app.config.ts`
- Modify: `apps/gallery/package.json`
- Modify: `apps/gallery/pnpm-lock.yaml`
- Create: `apps/gallery/tests/gallery-android-config.test.ts`
- Create: `apps/gallery/docs/ANDROID-ACCEPTANCE.md`

**Historical references:** PR #20 config, APK documentation, Android finalization notes.

**Interfaces:**

- Consumes: completed app and source dependencies.
- Produces: Expo public config for package `com.ollamabinsaden.gallery`, version `1.1.0`, versionCode `6`; uploaded Limrun APK asset `gallery-selective-port-1.1.0-debug.apk`.

- [ ] **Step 1: Write failing Expo config tests**

  Assert package/version/versionCode, owned scheme, required read permissions, no write permissions, no global `usesCleartextTraffic: true`, and no public Ollama host/token fields.

- [ ] **Step 2: Verify RED**

  Expected: current config lacks explicit versionCode 6/version 1.1.0 and any new required source configuration.

- [ ] **Step 3: Implement minimal Android config**

  Apply only dependencies/plugins/permissions required by implemented source flows. Keep package ID unchanged. Set the reviewed version values.

- [ ] **Step 4: Verify config and full local regression**

  ```bash
  corepack pnpm --dir apps/gallery test -- tests/gallery-android-config.test.ts tests/runtime-independence.test.ts
  corepack pnpm --dir apps/gallery exec expo config --type public
  bash scripts/codex/environment.sh test
  bash scripts/codex/environment.sh build
  git diff --check
  ```

  Expected: all pass; lint baseline is zero errors/five inherited warnings unless explicitly reduced.

- [ ] **Step 5: Run the remote Gradle build**

  ```bash
  lim gradle build . --expo-app-dir apps/gallery --upload gallery-selective-port-1.1.0-debug.apk
  ```

  Expected: build succeeds and uploads the named APK asset. Capture the build execution identifier and logs.

- [ ] **Step 6: Commit reproducible configuration and docs**

  Record build command and artifact name, but do not claim runtime acceptance.

  ```bash
  git add apps/gallery/app.config.ts apps/gallery/package.json apps/gallery/pnpm-lock.yaml apps/gallery/tests/gallery-android-config.test.ts apps/gallery/docs/ANDROID-ACCEPTANCE.md
  git commit -m "build(gallery): prepare Android acceptance candidate"
  ```

**Completion/stop:** A green Gradle build is insufficient. Do not call the task complete until the uploaded asset is installed and identified in Task 10.

---

### Task 10: Run Limrun device acceptance, restart verification, and final regression

**Files:**

- Modify: `apps/gallery/docs/ANDROID-ACCEPTANCE.md`
- Create review artifacts outside Git or in an explicitly approved evidence directory; never commit private imported data or credentials.

**Interfaces:**

- Consumes: Task 9 uploaded APK asset and final branch commit.
- Produces: remote-device evidence and final acceptance status; no product behavior unless a failure triggers a new TDD fix cycle.

- [ ] **Step 1: Create the emulator with the exact APK**

  Create one Limrun Android emulator with `gallery-selective-port-1.1.0-debug.apk`, using a stable idempotency key and a sufficient inactivity timeout. Record the returned instance ID and pass it explicitly to every later action.

  Expected: instance reaches ready with the APK installed.

- [ ] **Step 2: Verify installed package identity**

  Query device package metadata for `com.ollamabinsaden.gallery`.

  Expected: versionName `1.1.0`, versionCode `6`, resolvable launcher activity, minimum read permissions only.

- [ ] **Step 3: Launch with crash/exit monitoring**

  Launch the package and return control without blocking. Capture initial screenshot, element tree, and bounded app-log tail.

  Expected: app reaches the empty/degraded Home state with no crash or ANR.

- [ ] **Step 4: Exercise navigation and degraded states**

  Navigate Home, Images, Search, Library, Sources, Settings. Capture screenshots for empty/degraded, Search unavailable/no-match distinction, Settings/Ollama unavailable, and missing companion states.

  Expected: each destination is reachable and honestly labelled; no endpoint/token field appears.

- [ ] **Step 5: Exercise source permission paths**

  Test denied then granted media access; test limited access when the emulator OS exposes it; cancel document picker once.

  Expected: denial returns no fake assets; granted/limited items remain source-only.

- [ ] **Step 6: Exercise canonical import and occurrence display**

  Push a non-private fixture bundle to Downloads containing one canonical asset and two source occurrences. Select it through the app.

  Expected: one catalogue asset appears; detail shows both structured occurrences; imported filesystem locator is not opened.

- [ ] **Step 7: Exercise browse and Search states**

  Filter/browse the imported asset locally. Run a no-match. Attempt unavailable service Search modes.

  Expected: local browse works; no-match is distinct from unavailable; no lexical result claims semantic/visual/hybrid provenance.

- [ ] **Step 8: Exercise persistence**

  Apply a Gallery annotation/preferred occurrence, terminate the app, relaunch, and navigate back to the asset.

  Expected: same `asset_id`, both occurrences, and annotation/preference survive restart.

- [ ] **Step 9: Capture final logs and crash/ANR state**

  Fetch bounded app logs after all journeys.

  Expected: no crash, ANR, secret, raw private host, or `11434` leakage.

- [ ] **Step 10: Fix any finding through RED→GREEN**

  For each defect, write an automated reproducer first where feasible, watch it fail, implement the minimal fix, run the full relevant suite, rebuild/sync the APK, and repeat the affected Limrun journey. Never patch only the screenshot symptom.

- [ ] **Step 11: Run final complete regression on the final commit**

  ```bash
  bash scripts/codex/environment.sh test
  bash scripts/codex/environment.sh build
  git diff --check
  git status --short --branch
  ```

  Expected: all tests pass; TypeScript/server build pass; zero lint errors/no unexplained new warnings; only intentional tracked changes.

- [ ] **Step 12: Update acceptance documentation**

  Record base/final SHAs, exact APK asset, package/version, Limrun instance/session reference, journeys, screenshot/log references, known limitations, and physical Samsung status as either `verified` or `outstanding`.

- [ ] **Step 13: Commit evidence**

  ```bash
  git add apps/gallery/docs/ANDROID-ACCEPTANCE.md
  git commit -m "docs(gallery): record Android runtime acceptance"
  ```

**Completion/stop:** Any install failure, crash, ANR, persistence/provenance mismatch, false Search state, or private-host/credential leakage blocks completion. Physical Samsung may remain outstanding only if it is reported explicitly and Limrun passes.

---

### Task 11: Whole-branch review and standalone PR preparation

**Files:**

- Review all changes from merge base through final HEAD.
- Modify only files required for one Critical/Important fix pass.

**Interfaces:**

- Consumes: completed Tasks 1–10, specification, ledger, final Limrun evidence.
- Produces: reviewed branch and one draft standalone Gallery PR; no merge.

- [ ] **Step 1: Build the review package**

  Include plan/spec, commit range, diff/stat, stage ledger, test logs, Limrun evidence, and all rulings/deferred limitations.

- [ ] **Step 2: Request a fresh whole-branch review**

  Review specifically for canonical identity/provenance, source-only promotion, cache atomicity, Search truthfulness, raw Ollama leakage, session isolation, and Android evidence integrity.

- [ ] **Step 3: Re-grade findings and run one fix pass**

  Critical/Important findings receive a reproducing test, RED→GREEN fix, full regression, rebuilt APK, and repeated affected Limrun journey. Minor findings are recorded as deferred and do not silently expand scope.

- [ ] **Step 4: Re-run final verification after any fix**

  Run Task 10 Step 11 and repeat any affected device journeys.

- [ ] **Step 5: Prepare one draft PR**

  Target `hay-pixel/Gallery:main` from `feat/gallery-selective-pr20-port`. State explicitly that PR #20 was used as migration evidence and was not merged. Include file migration summary, tests, Limrun evidence, known unavailable service transports, and physical-device status.

- [ ] **Step 6: Attach the created PR to this Codex task**

  After successful PR creation, attach its URL through the Codex app.

**Completion/stop:** Do not merge. Stop with a draft PR ready for Hayden's review only when the exact final stop condition in the specification is satisfied.
