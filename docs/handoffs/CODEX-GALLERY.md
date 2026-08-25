# Codex Gallery migration handoff

## Implemented and preserved

PixelDrive `main` at `13e3d63` was migrated into `apps/gallery` without changing its Expo 54/React Native/tRPC technology. Home, Images, deterministic metadata Search and grounded catalogue Q&A, Library, Sources, Reviews, category decisions, mobile navigation, and non-destructive review behavior remain. Exact-content fixture rows are adapted into one canonical `asset_id` record with multiple source occurrences. User review/category/notes remain Gallery-local and do not alter ingest provenance.

The Google Drive integration remains a deliberately separate live **source view**. It requests only `drive.readonly`, stores source accounts separately, signs OAuth state, encrypts refresh tokens server-side with AES-256-GCM, validates owner/source access, and forwards Range requests through the media proxy. Drive file IDs are never promoted to canonical asset IDs.

## Template dependency audit

- **Dropped:** Manus parent-container runtime, Manus OAuth SDK/routes, Forge storage proxy, Forge LLM/image/voice/data/heartbeat/notification helpers, `BUILT_IN_FORGE_*`, `space.manus` identifiers, and template user auth. None belonged to proven Gallery/Drive behavior.
- **Adapted:** deep links and Expo application identifiers now use the project-owned `ollamabinsaden-gallery` scheme and `com.ollamabinsaden.gallery` package.
- **Retained:** provider-independent Expo/React/tRPC/Express/Drizzle infrastructure and direct Google OAuth/Drive APIs. Google Drive is independently justified and read-only.

No Codex, ChatGPT, Manus, Gemini, Google AI Studio, Forge, or `space.manus` service is a Gallery runtime dependency.

## Current boundaries and remaining work

The canonical adapter currently proves ingest-compatible identity and multi-source behavior over the migrated evaluation catalogue. It does not yet read the VM filesystem record store, because no accepted Gallery transport/storage interface exists. A permanent Gallery user-state store is also needed for cross-device reviews, preferred near-duplicate choices, labels, and source ownership; those decisions must remain separate from canonical ingest records.

Analysis and Search integration is intentionally capability-shaped (`available`, `pending`, `unsupported`, `unavailable`, `failed`) and optional. Basic deterministic browsing remains operational when they or Ollama are unavailable. Gallery still needs accepted service interfaces for:

1. paginated canonical assets plus all `source-occurrence-record-v1` occurrences by `asset_id`;
2. normalized analysis summaries/tags/categories and analysis state by `asset_id`;
3. deterministic/semantic search returning grounded `asset_id` values and search availability;
4. visual-similarity/near-duplicate candidates with scores and reasons, explicitly distinct from exact identity;
5. range-capable canonical media URLs with authorization suitable for native clients.

Do not bind Gallery to private Analysis/Search implementation details. VM deployment, real-data ingest-to-Gallery verification, Android device verification, credentialed Drive verification, and persistent server-side user state remain unfinished.

## PR #9 corrective security and production pass

Drive access now uses a project-owned, HMAC-signed, expiring Gallery session. The server creates an opaque session whose verified `ownerId` is the only owner accepted by Drive tRPC procedures, OAuth state, source queries, original-media routes, and thumbnail routes. Callers can no longer choose an `ownerKey`. This is intentionally an anonymous single-device identity boundary; account recovery and intentional cross-device identity remain future user-state work.

Web OAuth returns only to `${GALLERY_WEB_RETURN_ORIGINS}/oauth/drive` entries (comma-separated exact origins). Local development additionally permits localhost/127.0.0.1 port 8081. Native returns use the owned `ollamabinsaden-gallery` scheme or Expo development deep links. Cancelled consent verifies signed state before returning `drive=cancelled`.

Drive listings follow `nextPageToken`. Each source is fetched independently and returned as `available` or `unavailable`, so one revoked account does not hide healthy accounts. Bounded `thumbnailLink` content is proxied separately; original content remains authenticated and Range-capable. Server-side access tokens are cached until shortly before expiry, avoiding a refresh exchange per thumbnail.

Exact duplicate review is derived from one canonical asset with multiple source occurrences; near-duplicate groups remain separate assets. Deterministic search indexes provenance from every occurrence. Linked Drive filters use only defensible MIME/name metadata and return no remote project-category results when that classification is unavailable.

Production emits `dist/index.mjs`, and `pnpm start` executes that ESM entry. Production binds exactly `PORT` and fails if occupied; alternate-port probing is development-only. Migration `0003_expire_legacy_drive_owners.sql` deliberately deletes encrypted credentials attached to unmappable numeric development-era owners, requiring reconnection rather than leaving unreachable secrets. No accepted production PixelDrive account mapping exists.

### Corrective verification follow-up

Original media and thumbnail URLs now contain five-minute HMAC grants scoped to the authenticated owner, source ID, Drive file ID, and representation kind instead of the long-lived Gallery session. Thumbnail links supplied by Drive are not returned to clients: the server resolves the requested file's thumbnail metadata, restricts the fetch to HTTPS `*.googleusercontent.com`, bounds it to 400×400, and reuses the cached access token. Browser CORS is restricted to `GALLERY_WEB_RETURN_ORIGINS` (plus explicit local development origins); native clients remain supported without an Origin header.

The legacy-owner cleanup migration targets the actual `google_drive_sources` table. There is definitively no accepted production PixelDrive identity mapping in this convergence repository, so pre-production numeric-owner credentials are explicitly deleted and those users reconnect; credentials are not silently orphaned.

Production smoke verification uses `PORT=43119 NODE_ENV=production node dist/index.mjs` followed by `curl --fail http://127.0.0.1:43119/api/health`. The built server returned `{ "ok": true, ... }`. A second smoke check occupied port 43120 before starting with `PORT=43120 NODE_ENV=production`; startup exited non-zero with `EADDRINUSE` and did not probe another port.

## Current-main contract convergence

PR #9 was converged onto `main` after the accepted Analysis/VisualFeature contracts (`e511851`) and Search/Query/Ollama contracts (`7629cca`) merged. This pass intentionally adds no executable service route or client: those documents define future consumer semantics, while stable network transports for canonical assets, Analysis, Search, and Ollama do not yet exist.

Future Gallery adapters must preserve contract distinctions:

- Analysis availability and terminal-result provenance are explicit; pending, stale, failed, unsupported, and unavailable data must never be presented as completed analysis.
- Classifier labels/categories are not detector-grounded objects. Object UI must use `objects[]` evidence rather than promoting classifier tags.
- Exact duplicates remain multiple source occurrences of one canonical `asset_id`; visual near-duplicate results remain separate canonical assets returned by Search with relationship/provenance evidence.
- Search and Ollama results must remain grounded in returned canonical `asset_id` values and source occurrences. Ollama unavailability must not disable deterministic Gallery browsing and metadata search.

Until executable interfaces are accepted, the migrated deterministic catalogue and read-only Drive source view remain the only implemented Gallery data paths. No private hostname, guessed endpoint, raw Ollama API, or build-agent response shape is introduced here.
