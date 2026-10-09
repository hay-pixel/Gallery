# Gallery selective PR #20 port specification

**Status:** Review draft. This document authorizes no implementation until Hayden approves it.

**Target repository:** `hay-pixel/Gallery`

**Standalone baseline:** `main` at `f513a5ae5216cc4a7eeedabb06915f2e9a929809`

**Historical evidence:** `hay-pixel/Ollamabinsaden` PR #20, commit `2ab68bab8fe7b26d4f824260de29b24e8c4b3d8e`

## 1. Objective

Recover the tested and useful Gallery functionality from historical PR #20 without recreating its architecture. The standalone Gallery contracts, current `main`, and repository instructions are authoritative. PR #20 supplies behavior, tests, UX evidence, and implementation ideas; it does not supply durable identity, Search, Ollama, security, or module-boundary decisions.

The port succeeds when the standalone application can discover authorized local sources, ingest accepted canonical records, cache and browse them offline, preserve every source occurrence and Gallery-only user decision, expose truthful Search and Ollama degradation, and pass a real Limrun install/launch/journey/restart gate.

## 2. Binding architectural rules

1. The canonical pipeline is:

   ```text
   connector
     -> source occurrence
     -> canonical asset/catalogue record
     -> Analysis
     -> Search indexes
     -> Gallery / Ollama
   ```

2. `asset_id` is `sha256:<64 lowercase hexadecimal characters>` and remains the only durable asset identity. For asset-record v1, `content_hash` equals `asset_id`.
3. A filename, path, content URI, Google Drive ID, UI ID, database row ID, vector row ID, PR #20 source ID, or temporary build-agent ID never becomes durable asset identity.
4. Multiple source occurrences for identical canonical bytes remain distinct `SourceOccurrenceRecordV1` records linked to the same `asset_id`.
5. Source discovery records are not canonical assets. They may carry volatile provider handles and preview metadata, but they do not receive an `asset_id` until an approved canonicalization/import operation supplies one.
6. Imported `storage_locator` values are provenance/lookup metadata. The mobile client must not dereference an Extract host filesystem path.
7. Basic catalogue browse operates directly on canonical catalogue records when Analysis, Search indexes, or Ollama are unavailable.
8. Local browse/filter over records already loaded on the device is presentation logic, not a second Search engine and not a semantic, visual, or hybrid result.
9. Search owns metadata, visual, semantic, and hybrid retrieval. No client capability flag may relabel lexical filtering as semantic, visual, or hybrid retrieval.
10. Raw Ollama port `11434`, raw Ollama host URLs, and Ollama credentials remain server-side/private. Android and web clients call Gallery's backend only.
11. Ollama is optional. Its absence must not disable source browsing, canonical import, catalogue browsing, or deterministic Search.
12. Gallery-only annotations, review state, preferred occurrence/copy, notes, and UI cache state never mutate canonical asset or source-occurrence records.
13. Analysis status remains explicit: `pending`, `processing`, `ready`, `partial`, `unsupported`, `failed`, or `stale`. Classifier tags never become detector-grounded objects.
14. Build-agent services and IDs are not runtime dependencies.

## 3. Current-state baseline

Baseline captured on 2026-10-06 from clean standalone `main` at `f513a5a`, with only the local generated `.codex/` directory untracked.

| Area | Command | Result |
|---|---|---|
| Python Analysis/Search/integration | `.venv/bin/python -m pytest services/analysis/tests services/search/tests tests/integration` | 73 passed |
| TypeScript | `corepack pnpm --dir apps/gallery check` | Passed |
| Gallery application tests | `corepack pnpm --dir apps/gallery test` | 9 files, 22 tests passed |
| Lint | `corepack pnpm --dir apps/gallery exec eslint .` | 0 errors, 5 inherited warnings |
| Server build | `corepack pnpm --dir apps/gallery build` | Passed; `dist/index.mjs` produced |
| Android package | `apps/gallery/app.config.ts` | `com.ollamabinsaden.gallery` |
| Android native build | Not part of the current baseline | Unverified on standalone `main` |
| Device install/launch | Not part of the current baseline | Unverified on standalone `main` |

The inherited lint warnings are baseline evidence, not failures introduced by this port. A stage fails the regression gate if it adds lint errors or new warnings without an explicit reviewed justification.

### Implemented today

- Expo/React Native application and Node/tRPC backend.
- Fixture-based canonical identity behavior.
- Read-only Google Drive OAuth/source view.
- Gallery session ownership and media grants.
- Python Analysis image-v1 runtime.
- Python visual Search runtime and Analysis-to-Search feature bridge.
- Accepted Search, Query, Ollama, Visual Analysis, Visual Feature, asset, and source-occurrence contracts.

### Not implemented today

- Real standalone catalogue persistence and collection transport.
- Local device/source browsing.
- Canonical import UI and durable device cache.
- Metadata/semantic/hybrid Search service transport.
- Gallery-to-Search network adapter.
- Executable `services/ollama` adapter.
- Server-mediated model selection and grounded Ask.
- Standalone Android build, install, and runtime acceptance.

## 4. PR #20 inventory and migration principles

GitHub reports PR #20 as open, draft, mergeable, one commit, 38 changed files, 6,522 additions, and 125 deletions. It reports no CI checks. The PR body records 89 passing tests and an Android APK build, while explicitly stating that installation did not complete because the ADB target was unresponsive.

The tested behavioral evidence worth preserving includes:

- source-only local media/document discovery with denied and limited permission states;
- cursor-safe pagination;
- separation of discovered sources from canonical assets;
- strict canonical record validation and atomic import failure;
- preservation of every source occurrence;
- idempotent reimport preserving Gallery annotations and preferred choices;
- durable two-slot cache writes that retain the last complete snapshot after interrupted writes;
- deterministic lexical browse that never claims semantic/visual provenance;
- explicit disabled/unavailable Ollama behavior and citation integrity tests;
- backend-session isolation and restart persistence;
- companion launcher states independent from Search/Ollama;
- mobile source browsing, previews, Settings, navigation, safe-area behavior, and degradation messaging.

The historical combined `GalleryAsset` model, raw client-to-Ollama runtime, arbitrary client endpoint/token storage, monorepo task scripts, and 3,130-line screen are not portable architecture.

## 5. File-by-file migration matrix

`Current counterpart` names the standalone destination or the new focused destination proposed by this specification.

No PR #20 file qualifies for **PORT AS-IS**: every surviving file either references the monorepo layout, combines responsibilities that the standalone contracts separate, or requires dependency/configuration reconciliation against newer standalone `main`.

| PR #20 file | Decision | Current counterpart / destination | Rationale |
|---|---|---|---|
| `.vscode/tasks.json` | DO NOT PORT | `scripts/codex/environment.sh`, `docs/CODEX-ENVIRONMENT.md` | Monorepo editor tasks encode obsolete workspace paths. The standalone repository already owns reproducible actions. |
| `apps/gallery/.env.example` | PORT WITH ADAPTATION | `apps/gallery/.env.example` | Preserve documented Gallery/API configuration, but remove all `EXPO_PUBLIC_*OLLAMA*` host/token concepts. Any future Ollama adapter URL and credential are server-only. |
| `apps/gallery/GALLERY_APK_DOWNLOAD.md` | REIMPLEMENT AGAINST CURRENT CONTRACT | `apps/gallery/docs/ANDROID-ACCEPTANCE.md` | Historical artifact/version/download claims are stale. Replace them with reproducible build, package/version, Limrun, and physical-device evidence for this branch. |
| `apps/gallery/README.md` | PORT WITH ADAPTATION | root `README.md`, `apps/gallery/README.md` if still useful | Preserve behavior descriptions and setup details only where they match standalone scope and current contracts. Do not restore monorepo runtime claims. |
| `apps/gallery/app.config.ts` | PORT WITH ADAPTATION | same path | Preserve package ID, media/document support, deep-link scheme, and justified Android permissions. Do not port `usesCleartextTraffic: true` globally or client Ollama configuration. Set an explicit reviewed version/versionCode. |
| `apps/gallery/app/(tabs)/index.tsx` | DO NOT PORT | thin routes plus `features/*` screens and focused components | The 3,130-line screen mixes state, storage, network, navigation, and presentation. Preserve its user journeys by reimplementation, not wholesale transplant. |
| `apps/gallery/components/local-source-browser.tsx` | PORT WITH ADAPTATION | `features/sources/local-source-browser.tsx` | Preserve permission, pagination, picker, preview, and close behavior. Consume `DiscoveredSourceItem`; never mint canonical identity. |
| `apps/gallery/components/ollama-settings.tsx` | REIMPLEMENT AGAINST CURRENT CONTRACT | `features/settings/ollama-settings-screen.tsx` | Preserve health, model, capability, error, busy, and unavailable UX. Remove endpoint/token fields and direct raw runtime calls. |
| `apps/gallery/docs/ANDROID_FINALISATION.md` | REIMPLEMENT AGAINST CURRENT CONTRACT | `apps/gallery/docs/ANDROID-ACCEPTANCE.md` | Historical build/device evidence is not standalone acceptance. |
| `apps/gallery/docs/CANONICAL_IMPORT.md` | PORT WITH ADAPTATION | `apps/gallery/docs/CANONICAL-IMPORT.md` | Preserve import constraints and provenance rules, updated to pinned standalone schemas and the source-only/canonical split. |
| `apps/gallery/lib/gallery-session.ts` | PORT WITH ADAPTATION | `lib/session/gallery-session.ts` | Preserve current signed Gallery session semantics; adapt restart persistence and backend isolation without user-entered arbitrary backends. |
| `apps/gallery/lib/gallery/ask.ts` | REIMPLEMENT AGAINST CURRENT CONTRACT | `lib/ollama/types.ts`, `server/ollama-gateway.ts`, backend tRPC routes | Preserve unavailable/grounded/citation behavior, but all reasoning calls go through Gallery's backend and project-facing Ollama operations. |
| `apps/gallery/lib/gallery/assets.ts` | REIMPLEMENT AGAINST CURRENT CONTRACT | `lib/catalogue/types.ts`, `lib/catalogue/view-model.ts`, `lib/catalogue/annotations.ts` | PR #20 combines canonical records, Analysis, presentation, Search, cache, and annotations. Split authoritative records from derived views and user state. |
| `apps/gallery/lib/gallery/cache-storage.ts` | PORT WITH ADAPTATION | `lib/catalogue/cache-store.ts` | Preserve serialized writes, two-slot commit, legacy migration, and last-complete-snapshot behavior using Expo 54-compatible filesystem APIs. |
| `apps/gallery/lib/gallery/canonical-import.ts` | PORT WITH ADAPTATION | `lib/catalogue/contracts.ts`, `lib/catalogue/import.ts`, `lib/catalogue/merge.ts` | Preserve strict validation, idempotence, atomic conflict handling, and occurrence retention. Store records separately and never dereference imported locators. |
| `apps/gallery/lib/gallery/device-cache.ts` | PORT WITH ADAPTATION | `lib/catalogue/device-cache.ts` | Preserve persistent cache adapter, but use the new normalized snapshot and supported Expo filesystem API. |
| `apps/gallery/lib/gallery/launcher.ts` | PORT WITH ADAPTATION | `lib/launcher/companion.ts` | Preserve missing/unconfigured/incompatible/ready state derivation. Companions remain optional; launch uses owned deep-link schemes and `canOpenURL`. |
| `apps/gallery/lib/gallery/native-sources.ts` | PORT WITH ADAPTATION | `lib/sources/native.ts` | Preserve adapter seams, denied/limited states, pagination cursor guard, document picking, and source-only behavior. |
| `apps/gallery/lib/gallery/ollama-errors.ts` | PORT WITH ADAPTATION | `lib/ollama/types.ts` | Preserve stable error/status vocabulary at the Gallery boundary, not raw Ollama HTTP errors. |
| `apps/gallery/lib/gallery/ollama-runtime.ts` | DO NOT PORT | future `services/ollama` implementation; `server/ollama-gateway.ts` is consumer boundary only | This file directly accepts raw endpoints/tokens and calls `/api/tags`, `/api/show`, and `/api/generate` from the client. That violates the accepted private-runtime boundary. |
| `apps/gallery/lib/gallery/ollama-settings-store.ts` | REIMPLEMENT AGAINST CURRENT CONTRACT | server-side model preference/configuration plus `features/settings/ollama-settings-screen.tsx` | Do not persist raw endpoint or token on Android. Preserve only server-safe model selection and capability preferences. |
| `apps/gallery/lib/gallery/pick-canonical-import.ts` | PORT WITH ADAPTATION | `lib/catalogue/pick-import.ts` | Preserve document-picker flow and bounded text read. Validate before merge and do not treat arbitrary picked files as canonical assets. |
| `apps/gallery/lib/gallery/search.ts` | REIMPLEMENT AGAINST CURRENT CONTRACT | `lib/catalogue/browse.ts`, `lib/search/types.ts`, `server/search-gateway.ts` | Split local catalogue browse from Search service operations. Never fabricate semantic/visual/hybrid provenance. |
| `apps/gallery/lib/gallery/secure-settings.ts` | DO NOT PORT | none on client; server runtime configuration only | Its purpose is securing arbitrary raw Ollama endpoints/tokens on the device. Those values must not exist in the client architecture. |
| `apps/gallery/lib/gallery/server-session-store.ts` | PORT WITH ADAPTATION | `lib/session/gallery-session-store.ts` | Preserve origin isolation, restart persistence, safe keys, and rejection of embedded credentials/unsafe protocols. Restrict origins to the configured Gallery API, not arbitrary user-entered backends. |
| `apps/gallery/lib/gallery/sources.ts` | PORT WITH ADAPTATION | `lib/sources/types.ts`, `lib/sources/adapters.ts` | Preserve source-only states, access state, and provider metadata. Rename URI-derived identifiers as volatile discovery handles so they cannot be mistaken for durable source/asset identity. |
| `apps/gallery/lib/pixeldrive.ts` | PORT WITH ADAPTATION | same file during transition, then `lib/catalogue/fixture-adapter.ts` and feature modules | Retain existing standalone fixture/review tests and compatibility adapter while moving durable logic out of the fixture module. |
| `apps/gallery/lib/trpc.ts` | PORT WITH ADAPTATION | same path | Extend only with typed Gallery backend Search/Ollama operations; do not add raw runtime clients. |
| `apps/gallery/package.json` | PORT WITH ADAPTATION | same path | Add only justified Expo source/file dependencies and UI test support. Do not port missing monorepo `@ollamabinsaden/contracts`; validate pinned local schemas. Regenerate the lockfile. |
| `apps/gallery/pnpm-lock.yaml` | PORT WITH ADAPTATION | same path | Regenerate from standalone `package.json`; never copy the monorepo lockfile wholesale. |
| `apps/gallery/tests/gallery-canonical-import.test.ts` | PORT WITH ADAPTATION | same/new split tests | Preserve validation, atomicity, idempotence, occurrence retention, annotation preservation, large-cache, and interrupted-write intent. Remove direct raw Ollama coupling from the end-to-end case. |
| `apps/gallery/tests/gallery-domain.test.ts` | PORT WITH ADAPTATION | `gallery-catalogue.test.ts`, `gallery-browse.test.ts`, `gallery-launcher.test.ts` | Preserve fixture adaptation, source/canonical separation, offline state, deterministic browse, degradation, and launcher behavior against focused modules. |
| `apps/gallery/tests/gallery-native-sources.test.ts` | PORT WITH ADAPTATION | same path | Preserve all five behavior classes and add restart/revoked-access cases. |
| `apps/gallery/tests/gallery-ollama-runtime.test.ts` | REIMPLEMENT AGAINST CURRENT CONTRACT | `gallery-ollama-boundary.test.ts`, server gateway tests | Preserve disabled/unavailable/model/capability/timeout/grounding intent at the backend boundary. Delete client endpoint/token/raw API expectations. |
| `apps/gallery/tests/gallery-server-session-store.test.ts` | PORT WITH ADAPTATION | `gallery-session-store.test.ts` | Preserve isolation, persistence, safe keying, and unsafe-origin rejection under the configured Gallery API model. |
| `apps/gallery/tests/oauth-return-uri.test.ts` | PORT WITH ADAPTATION | same path | Merge only assertions still missing from current standalone OAuth behavior; retain current stricter return-origin contract. |
| `apps/gallery/tests/runtime-independence.test.ts` | PORT WITH ADAPTATION | same path | Extend scans to forbid client raw Ollama URLs/tokens, build-agent coupling, and accidental monorepo package imports. |
| `scripts/app` | DO NOT PORT | `scripts/codex/environment.sh`, package scripts | Monorepo launcher paths and multi-app assumptions do not belong in the standalone repository. |

## 6. Target data model

The cache and application state must not persist one combined PR #20 `GalleryAsset` object as contract truth. Persist normalized collections:

```ts
type GalleryCatalogueSnapshotV1 = {
  schema: "gallery-catalogue-cache";
  schema_version: 1;
  saved_at: string;
  canonical_assets: AssetRecordV1[];
  source_occurrences: SourceOccurrenceRecordV1[];
  analysis_views: AnalysisView[];
  annotations: Record<AssetId, GalleryAnnotations>;
  discovered_sources: DiscoveredSourceItem[];
  capability_state: CapabilityStateSnapshot;
};
```

`AssetRecordV1` and `SourceOccurrenceRecordV1` match the pinned JSON Schemas under `contracts/`. `GalleryAnnotations` contains only Gallery-owned review state, notes, preferred occurrence/copy, labels, and presentation choices. `AnalysisView` is a normalized consumer view with explicit status and exact `analysis_id`/`result_id` when available. `DiscoveredSourceItem` is source-only and has no `asset_id` unless an approved import result links it.

At runtime, `buildCatalogueAssetView(asset_id, snapshot)` joins these collections into an immutable presentation view. It must reject orphan occurrences/annotations and must not overwrite canonical/source records.

### Canonical import forms

The port accepts:

1. one `AssetRecordV1` response;
2. the versioned PR #20 `gallery-canonical-import` envelope containing asset and occurrence v1 records plus bounded optional presentation metadata.

The envelope is a Gallery import adapter, not a new Extract-owned permanent contract. If Extract publishes a tagged collection export contract before execution reaches the import stage, the adapter must add that accepted format without weakening the v1 validation rules.

Imported `storage_locator`, paths, and source locations are never opened by the mobile client. Remote preview URLs are rejected; a bounded embedded data URI may be accepted only as non-authoritative presentation data.

## 7. Proposed module and component architecture

### Domain and persistence

| Module | Responsibility |
|---|---|
| `lib/catalogue/contracts.ts` | Zod validation and TypeScript types matching the pinned asset/source-occurrence schemas. |
| `lib/catalogue/types.ts` | Snapshot, annotations, Analysis view, capability, and assembled catalogue-view types. |
| `lib/catalogue/view-model.ts` | Pure joins from normalized records to immutable `CatalogueAssetView`. |
| `lib/catalogue/fixture-adapter.ts` | Converts current `FileRecord` fixtures into accepted in-memory catalogue records for demos/tests only. |
| `lib/catalogue/import.ts` | Parses bounded single-record and bundle inputs; returns normalized records without mutation. |
| `lib/catalogue/merge.ts` | Atomically merges records by `asset_id`, preserves all occurrences and Gallery annotations, rejects conflicts. |
| `lib/catalogue/cache-store.ts` | Serialized two-slot storage with commit pointer and last-complete-snapshot recovery. |
| `lib/catalogue/device-cache.ts` | Expo filesystem/AsyncStorage adapters and cache migration wiring. |
| `lib/catalogue/pick-import.ts` | Document-picker and bounded read orchestration. |
| `lib/sources/types.ts` | `DiscoveredSourceItem`, access state, provider capabilities, volatile discovery handle. |
| `lib/sources/native.ts` | Media-library and document-picker adapters; permission and pagination behavior. |
| `lib/launcher/companion.ts` | Optional Extract/Assist deep-link targets and derived launch states. |
| `lib/session/gallery-session-store.ts` | Persisted Gallery backend sessions isolated by approved API origin. |

### Search

| Module | Responsibility |
|---|---|
| `lib/catalogue/browse.ts` | Local filtering/sorting over already loaded canonical catalogue views. Returns views, never Search result provenance. |
| `lib/search/types.ts` | Stable client-facing Search envelopes, canonical result fields, cursor, and typed availability/stale/failure unions. |
| `server/search-gateway.ts` | Server-only `SearchGateway` interface and `UnavailableSearchGateway`; future transport to the Python Search service plugs in here. |
| `server/routers.ts` | tRPC Search operations call the gateway and preserve typed states. No local mobile vector/index implementation. |

No stage in this port implements metadata, semantic, or hybrid indexing inside the mobile client. The existing Python visual Search remains authoritative for visual similarity. Until an executable transport is accepted, service-backed Search returns a typed unavailable state while catalogue browse remains usable.

### Ollama

| Module | Responsibility |
|---|---|
| `lib/ollama/types.ts` | Client-safe health/model/capability/error/grounded-answer types with no host or credential fields. |
| `server/ollama-gateway.ts` | Server-only consumer interface for project-facing `services/ollama` operations and typed unavailable default. It never exposes raw Ollama payloads. |
| `server/routers.ts` | tRPC health/models/capabilities/grounded-answer operations. |
| `features/settings/ollama-settings-screen.tsx` | Model preference and status UX using Gallery backend responses only. |

This port does not implement raw Ollama transport in the client or full `services/ollama`. Server runtime configuration may later name a private project-facing adapter URL and credential, but those variables must not use `EXPO_PUBLIC_*` and must not be returned to clients.

### UI

| Route/component | Responsibility |
|---|---|
| `app/(tabs)/index.tsx` | Thin Home route only. |
| `app/(tabs)/images.tsx` | Thin Images route only. |
| `app/(tabs)/search.tsx` | Thin Search route only. |
| `app/(tabs)/library.tsx` | Thin Library route only. |
| `app/(tabs)/sources.tsx` | Thin Sources route only. |
| `app/(tabs)/settings.tsx` | Thin Settings route only. |
| `features/catalogue/catalogue-provider.tsx` | Hydration, snapshot updates, atomic persistence, and view-model selectors. No rendering policy. |
| `features/home/home-screen.tsx` | Counts, recent canonical assets, capability summaries, navigation actions. |
| `features/images/images-screen.tsx` | Canonical image/video presentation and previews. |
| `features/library/library-screen.tsx` | Catalogue filters, review/duplicate entry points, detail selection. |
| `features/search/search-screen.tsx` | Local browse versus service Search mode, typed unavailable/stale states, no fabricated modes. |
| `features/sources/sources-screen.tsx` | Linked Drive sources, local source browser, canonical import entry point. |
| `features/sources/local-source-browser.tsx` | Permission, paging, source-only previews, document picker. |
| `features/settings/settings-screen.tsx` | Gallery/backend status, companion launch state, link to Ollama model/status UX. |
| `features/settings/ollama-settings-screen.tsx` | Backend-reported model selection/capability state; no endpoint/token input. |
| `components/catalogue/asset-card.tsx` | Reusable asset summary. |
| `components/catalogue/asset-detail-sheet.tsx` | Canonical metadata, occurrences, Analysis/degradation, Gallery annotations. |
| `components/capability-banner.tsx` | Consistent `unavailable`, `stale`, `partial`, `failed`, and `unsupported` messaging. |

Routes do not own persistence, network clients, canonical validation, or query algorithms. UI behavior from PR #20 is recovered through these boundaries rather than copied from its single screen.

## 8. Numbered implementation stages

### Stage 0 — isolated branch and reproducible baseline

**Files/modules:** no product changes; execution workspace only.

**Historical source:** none.

**Current counterpart:** standalone `main` and `scripts/codex/environment.sh`.

**Work:** create one isolated worktree/branch `feat/gallery-selective-pr20-port` from then-current `origin/main`; leave the original checkout and untracked `.codex/` state untouched. Record SHA and rerun baseline.

**Commands:**

- `bash scripts/codex/environment.sh setup`
- `bash scripts/codex/environment.sh test`
- `bash scripts/codex/environment.sh build`

**Acceptance:** same or better than the baseline in section 3; inherited five warnings recorded by name; no source changes.

**Dependency:** specification approval.

**Stop condition:** any baseline failure or unexpected main-branch drift stops implementation until diagnosed and the baseline section is updated.

### Stage 1 — contract-aligned catalogue domain

**Files/modules:** `lib/catalogue/contracts.ts`, `types.ts`, `view-model.ts`, `fixture-adapter.ts`, `annotations.ts`; transition edits to `lib/pixeldrive.ts` only where required.

**PR #20 sources:** `lib/gallery/assets.ts`, `lib/gallery/sources.ts`, `tests/gallery-domain.test.ts`.

**Current counterparts:** `lib/pixeldrive.ts`, `contracts/*.schema.json`, `tests/pixeldrive.logic.test.ts`.

**Tests:** add `tests/gallery-catalogue.test.ts`; port fixture gating, source/canonical separation, occurrence multiplicity, annotation preservation, orphan rejection, classifier/object distinction, and view-model immutability.

**Commands:**

- `corepack pnpm --dir apps/gallery test -- tests/gallery-catalogue.test.ts tests/pixeldrive.logic.test.ts`
- `corepack pnpm --dir apps/gallery check`

**Acceptance:** canonical keys are exclusively `asset_id`; exact duplicate fixtures collapse to one asset with multiple occurrences; user annotations remain separate; sample data is opt-in.

**Dependency:** Stage 0.

**Stop condition:** no import, cache, source UI, or Search work begins until the domain tests prove the normalized model.

### Stage 2 — canonical import, atomic merge, and durable cache

**Files/modules:** `lib/catalogue/import.ts`, `merge.ts`, `cache-store.ts`, `device-cache.ts`, `pick-import.ts`; `apps/gallery/docs/CANONICAL-IMPORT.md`.

**PR #20 sources:** `canonical-import.ts`, `cache-storage.ts`, `device-cache.ts`, `pick-canonical-import.ts`, `gallery-canonical-import.test.ts`.

**Current counterparts:** pinned schemas, Stage 1 catalogue model, current AsyncStorage hydration in `app/(tabs)/index.tsx`.

**Tests:** port single-record and bundle validation, identity/hash equality, orphan/duplicate rejection, remote-preview rejection, idempotent reimport, conflict atomicity, annotations/preferred occurrence preservation, 20,000-source cache restart, interrupted slot write, failed pointer update, serialized writes, and schema-version rejection.

**Commands:**

- `corepack pnpm --dir apps/gallery test -- tests/gallery-canonical-import.test.ts tests/gallery-cache.test.ts`
- `corepack pnpm --dir apps/gallery check`

**Acceptance:** cache persists normalized collections; failed writes preserve the previous complete snapshot; imported paths are never opened; merge is all-or-nothing.

**Dependency:** Stage 1.

**Stop condition:** no UI import button ships until an import followed by process-style cache reinitialization restores identical asset IDs, occurrences, and annotations.

### Stage 3 — native sources, session isolation, and optional launchers

**Files/modules:** `lib/sources/types.ts`, `native.ts`, `lib/session/gallery-session-store.ts`, `lib/launcher/companion.ts`; package and Expo configuration changes needed by these modules.

**PR #20 sources:** `native-sources.ts`, `sources.ts`, `server-session-store.ts`, `gallery-session.ts`, `launcher.ts`, related tests.

**Current counterparts:** `lib/gallery-session.ts`, Drive session flow, `app.config.ts`, `package.json`.

**Tests:** preserve permission denied/limited/granted, repeated cursor guard, document cancel/select, source-only identity, revoked access after restart, backend-origin session isolation, embedded-credential/unsafe-protocol rejection, companion missing/unconfigured/incompatible/ready states.

**Commands:**

- `corepack pnpm --dir apps/gallery test -- tests/gallery-native-sources.test.ts tests/gallery-session-store.test.ts tests/gallery-launcher.test.ts`
- `corepack pnpm --dir apps/gallery check`
- `corepack pnpm --dir apps/gallery exec expo config --type public`

**Acceptance:** discovery returns no fabricated `asset_id`; only read permissions are requested; session material never crosses Gallery API origins; missing companions do not impair Gallery.

**Dependency:** Stages 1–2.

**Stop condition:** source discovery stops if an API would require write permission, silently copies originals, or promotes URI/provider IDs to canonical identity.

### Stage 4 — catalogue browse and truthful Search boundary

**Files/modules:** `lib/catalogue/browse.ts`, `lib/search/types.ts`, `server/search-gateway.ts`, Search tRPC routes and client adapters.

**PR #20 sources:** `lib/gallery/search.ts`, Search portions of domain/import tests.

**Current counterparts:** `lib/pixeldrive.ts::searchFiles`, Python `services/search`, Search and Query contracts.

**Tests:** local browse returns canonical views without Search provenance; metadata no-match differs from unavailable; semantic/visual/hybrid unavailable and stale states remain typed; cursor remains opaque; service result identity is always `asset_id`; visual similarity never becomes exact duplicate; a requested semantic/visual mode cannot relabel lexical results.

**Commands:**

- `corepack pnpm --dir apps/gallery test -- tests/gallery-browse.test.ts tests/gallery-search-boundary.test.ts`
- `.venv/bin/python -m pytest services/search/tests tests/integration/test_analysis_search.py`
- `corepack pnpm --dir apps/gallery check`

**Acceptance:** browse works with an unavailable Search gateway; service Search calls remain server-mediated and contract-shaped; no client index/vector implementation is introduced.

**Dependency:** Stages 1–2.

**Stop condition:** stop if any client result claims semantic, visual, hybrid, or exact-duplicate status without the required service evidence.

### Stage 5 — private Ollama boundary and server-safe settings concepts

**Files/modules:** `lib/ollama/types.ts`, `server/ollama-gateway.ts`, Ollama tRPC routes, `.env.example` server-only placeholders, runtime-independence tests.

**PR #20 sources:** `ask.ts`, `ollama-errors.ts`, settings UX behavior, Ollama tests. Explicitly excludes `ollama-runtime.ts`, `secure-settings.ts`, and raw settings persistence.

**Current counterparts:** `services/ollama/README.md`, Ollama and Query contracts, `server/routers.ts`.

**Tests:** unavailable service, missing model, capability unsupported, timeout/error mapping, empty answer degradation, no evidence means no call, exact supporting `asset_id` citations, server-only configuration, no `EXPO_PUBLIC` Ollama host/token, no client `/api/tags|show|generate` calls, no `11434` in client production code.

**Commands:**

- `corepack pnpm --dir apps/gallery test -- tests/gallery-ollama-boundary.test.ts tests/runtime-independence.test.ts`
- `corepack pnpm --dir apps/gallery check`

**Acceptance:** the default gateway is typed unavailable; the client can present health/model/capability state without learning host or credentials; ordinary browse/Search remains unaffected.

**Dependency:** Stage 4 types for grounding/search evidence.

**Stop condition:** no full inference transport is implemented in this port; stop if satisfying a test would require a client raw Ollama endpoint or an invented `services/ollama` wire format.

### Stage 6 — focused UI integration

**Files/modules:** thin tab routes, feature screens, catalogue provider, local source browser, asset cards/detail, capability banner, safe Ollama settings screen.

**PR #20 sources:** `index.tsx`, both historical components, mobile UX behavior only.

**Current counterparts:** current 164-line `index.tsx`, hidden tab layout, Drive views.

**Tests:** route/component smoke tests; hydration and empty catalogue; source permission states; canonical import error/success; browse after Search/Ollama unavailable; navigation to Home/Images/Search/Library/Sources/Settings; detail occurrence list; model status without endpoint fields; safe-area/back behavior.

**Commands:**

- `corepack pnpm --dir apps/gallery test -- tests/gallery-navigation.test.tsx tests/gallery-sources-ui.test.tsx tests/gallery-degraded-ui.test.tsx`
- `corepack pnpm --dir apps/gallery check`
- `corepack pnpm --dir apps/gallery exec eslint .`

**Acceptance:** each route delegates to one feature screen; persistence/network/domain logic remains outside route components; Home and Images show useful previews; Settings and typed unavailable states are reachable; Drive behavior remains read-only.

**Dependency:** Stages 1–5.

**Stop condition:** stop and split further if implementation begins recreating a monolithic screen or mixes raw provider responses into presentation components.

### Stage 7 — Android configuration and reproducible package

**Files/modules:** `package.json`, regenerated lockfile, `app.config.ts`, Android acceptance documentation.

**PR #20 sources:** dependency/config changes and Android finalization evidence.

**Current counterparts:** current Expo 54 configuration and Codex environment scripts.

**Tests:** Expo public config snapshot, package ID, versionName/versionCode, required read permissions, absence of global cleartext opt-in, deep-link schemes, production dependency scan.

**Version decision:** use `version: 1.1.0` and Android `versionCode: 6`. This exceeds known historical PR #20 build 4 and later Gallery test build 5, avoiding downgrade failures on previously used devices. Review may change this before implementation, but execution must not silently choose another value.

**Commands:**

- `corepack pnpm --dir apps/gallery exec expo config --type public`
- `lim gradle build . --expo-app-dir apps/gallery --upload gallery-selective-port-1.1.0-debug.apk`

**Acceptance:** remote Gradle build succeeds from the clean worktree; uploaded asset is uniquely named; package is `com.ollamabinsaden.gallery`, versionName `1.1.0`, versionCode `6`.

**Dependency:** Stages 1–6 and complete regression gate.

**Stop condition:** build success alone does not complete this stage; failure to identify package/version or install the same asset blocks device acceptance.

### Stage 8 — Limrun runtime acceptance and release evidence

**Files/modules:** evidence under `apps/gallery/docs/ANDROID-ACCEPTANCE.md`; screenshots/log references as review artifacts rather than committed secrets or private data.

**Historical source:** PR #20 device limitation and Android UX checklist.

**Current counterparts:** none; this is the missing runtime gate.

**Commands/tools:** create one Limrun Android emulator with the uploaded APK; pass its explicit instance ID to every action; query package metadata; launch; inspect element tree/screenshot; exercise journeys; capture application logs; terminate/relaunch; delete or allow expiry after evidence is saved.

**Journeys:**

1. cold launch with no canonical assets and unavailable Search/Ollama;
2. Home/Images/Library/Sources/Settings navigation;
3. media permission denied, limited where supported, then granted;
4. document picker cancellation and a safe test import selected from Downloads;
5. canonical import with two occurrences for one `asset_id`;
6. offline catalogue browse and local filter;
7. Search no-match versus unavailable/stale presentation;
8. Ollama unavailable/model-unavailable presentation with no host/token UI;
9. missing companion launcher behavior;
10. app termination and relaunch proving catalogue/annotation/source-state persistence.

**Evidence:** package/version dump, launch result, at least one screenshot for empty/degraded, Sources/import, catalogue detail with occurrences, Search state, Settings/Ollama state, and post-restart state; bounded app log tail after each failure-prone journey; explicit crash/ANR result.

**Acceptance:** installed package launches; journeys produce the specified states; no crash/ANR; post-restart asset IDs, occurrences, and annotations match; logs contain no credential or raw private host leakage.

**Dependency:** Stage 7.

**Stop condition:** any install failure, crash, ANR, persistence loss, incorrect identity/provenance, or private-host leak blocks remote-device acceptance.

### Stage 9 — complete regression and PR preparation

**Files/modules:** documentation/evidence and final diff only.

**Tests/commands:**

- `bash scripts/codex/environment.sh test`
- `bash scripts/codex/environment.sh build`
- repeat the exact Limrun smoke journey on the final APK if code/config changed after Stage 8
- inspect `git diff --check`, production dependency scans, and final file inventory

**Acceptance:** 73+ Python tests pass; all existing and migrated app tests pass; TypeScript passes; server build passes; lint has zero errors and no unexplained new warnings; Limrun evidence is from the final commit; PR describes preserved behavior, deliberate omissions, known limitations, and physical-device status.

**Dependency:** Stages 1–8.

**Stop condition:** do not open or mark the PR ready if any required check or Limrun journey is red, or if the documentation implies physical-device verification that did not occur.

## 9. Branch and PR strategy

- Create one branch, `feat/gallery-selective-pr20-port`, from current standalone `origin/main` after specification approval.
- Never merge or cherry-pick PR #20 into standalone Gallery. Use its commit only for file-level reference.
- Do not rewrite standalone `main`.
- Use stage-scoped commits with tests run before each commit.
- Prefer one coherent standalone Gallery PR because the catalogue types, cache, source UI, Search degradation, and Android acceptance share interfaces and must be reviewed together.
- Split only if review finds a genuinely independent change that can ship and pass Limrun without depending on the remaining stages. Documentation-only or dependency-only PRs are not sufficient reasons to split.
- The generated local `.codex/` configuration is unrelated working state and is not included in this port PR unless separately approved.

## 10. Android and Limrun acceptance protocol

1. Build through Limrun remote Gradle from a clean implementation worktree; do not rely on a local VM emulator.
2. Upload the exact built debug APK as `gallery-selective-port-1.1.0-debug.apk`.
3. Create/reuse one labelled disposable Android instance and install that asset.
4. Verify installed package, versionName, versionCode, main launch activity, and requested permissions from the device.
5. Launch with monitoring capable of reporting crash/ANR/exit reasons.
6. Capture UI hierarchy before each selector-driven action; use screenshot-coordinate fallback only if React Native exposes no nodes.
7. Run the ten journeys in Stage 8, capturing screenshots and bounded logs.
8. Terminate and relaunch to prove persistence.
9. Rebuild/reinstall and repeat affected journeys after any fix.
10. Keep Limrun acceptance separate from physical Samsung acceptance.

Physical Samsung S23 Ultra installation is the final real-device gate. It must be reported as either:

- **verified**, with installed version and journey evidence; or
- **outstanding**, with Limrun status and the exact remaining physical-device checks.

## 11. Risks and contract questions

| Risk/question | Proposed ruling for this port | Consequence if wrong |
|---|---|---|
| Extract has not yet published a tagged collection export envelope. | Keep PR #20's bounded envelope as a Gallery adapter over pinned v1 records; do not claim it is the permanent Extract contract. | A later adapter may be needed; canonical records remain unchanged. |
| Local device items have bytes but no accepted ingestion/canonicalization service path. | Keep them source-only in this port. Do not hash/mint canonical records in the client. | Local browse can show authorized source previews before items enter the durable catalogue. Full local ingest remains a follow-up. |
| Search has a Python visual runtime but no accepted Gallery transport; metadata/semantic/hybrid remain incomplete. | Define a server-side gateway and typed unavailable default. Implement no competing client index. | Search UI is truthful but some modes remain unavailable until a transport/API follow-up. |
| `services/ollama` is documentation-only. | Define only the Gallery server consumer boundary and unavailable UX. Do not invent raw adapter wire formats. | Model discovery/reasoning remains unavailable until the service owner implements the adapter. |
| PR #20 allowed arbitrary client endpoints and credentials. | Omit that behavior. Client stores no raw endpoint/token; server owns runtime configuration. | Users cannot point the mobile app directly at ad hoc Ollama hosts, by design. |
| Current Gallery session token uses AsyncStorage. | Adapt PR #20's session isolation and native secure persistence while preserving the signed server-session model; web uses appropriate browser storage. | Migration must preserve existing sessions or explicitly recreate anonymous sessions safely. |
| Android media permissions vary by API level and selected-photo access. | Request the minimum read permissions through Expo media-library, validate public config, and test denied/limited/granted paths on Limrun. | Some device-source journeys may remain limited on OS versions not represented by Limrun and need Samsung verification. |
| Known historical builds used versionCodes 4 and 5. | Use versionName `1.1.0`, versionCode `6`. | Avoids downgrade install failure; product owner may revise before coding. |
| PR #20's cache stored one combined object. | Migrate to normalized cache v1 and preserve a one-time safe legacy read path where recognizable. | Unrecognized/corrupt legacy state falls back safely without mutating canonical data. |

## 12. Exact final stop condition

The selective port is complete only when all of the following are simultaneously true on the final implementation commit:

1. every stage's targeted tests pass;
2. complete Python, TypeScript, app-test, lint, and server-build baselines pass with zero lint errors and no unexplained new warnings;
3. no client production code contains or accepts a raw Ollama endpoint, token, `/api/tags`, `/api/show`, `/api/generate`, or port `11434`;
4. no local source/provider/path/UI/index identifier is used as canonical asset identity;
5. an imported asset with two source occurrences persists as one `asset_id` with both occurrences after restart;
6. Gallery annotations survive idempotent reimport and restart without mutating canonical/source records;
7. basic catalogue browse works while Search and Ollama gateways are unavailable;
8. semantic/visual/hybrid unavailable or stale states are truthful and never replaced with lexical results carrying false provenance;
9. the exact final APK is built reproducibly, identified as `com.ollamabinsaden.gallery` versionName `1.1.0` versionCode `6`, installed on Limrun, launched, exercised through every required journey, restarted, and checked for crash/ANR/log leakage;
10. the PR records physical Samsung acceptance separately as verified or outstanding;
11. final review finds no Critical or Important contract, identity, security, persistence, or runtime-acceptance defect.

A successful unit-test run, server build, Gradle build, uploaded APK, installed package, or single screenshot satisfies only its corresponding gate. None alone is completion.
