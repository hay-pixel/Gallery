# Ollamabinsaden Gallery

Mobile-first Expo 54/React Native migration of PixelDrive. It preserves Home, Images, deterministic Search, Library, Sources, Reviews, local category/review decisions, and the secure read-only Google Drive source browser.

Canonical catalogue records are keyed by ingest `asset_id` (`sha256:<digest>`) and contain all source occurrences. Exact identical bytes appear once; filenames, archive members, and Drive file IDs are provenance—not asset identity. Live Drive listings remain a separate source view until Ingest creates canonical records.

## Commands

For native Android builds and the folder to open in Android Studio, see
[Android Studio setup](../../docs/ANDROID-STUDIO.md).

```bash
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

## Runtime configuration

Set `DATABASE_URL`, `GALLERY_WEB_RETURN_ORIGINS` (comma-separated exact Gallery web origins), `JWT_SECRET`, `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, and `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET` on the server. Set `EXPO_PUBLIC_API_BASE_URL` and, for web deployments, `EXPO_PUBLIC_GALLERY_RETURN_ORIGIN` for clients that cannot derive the API origin. Never expose OAuth secrets or refresh tokens to Expo clients. Google authorization requests only `drive.readonly`; refresh tokens are AES-256-GCM encrypted server-side.

Analysis and Search are optional capabilities with explicit availability states. Deterministic catalogue browsing/search works while Analysis, Search similarity, or Ollama is unavailable. Current sample data is an adapter/evaluation catalogue; wiring the filesystem ingest record reader and permanent Search/Analysis HTTP contracts remains integration work.

Production uses `dist/index.mjs` and binds exactly `PORT`. Anonymous signed Gallery sessions provide device-local Drive ownership; cross-device account recovery is not implemented yet.

## Runtime repair checkpoint

See [runtime repair evidence and remaining gaps](docs/RUNTIME-REPAIR.md) for the 2026-11-11
source-action, imported-preview, offline-answer and filter-layout repairs. Browser regression
checks are documented in `tests/browser/README.md` at the repository root. A new native build
is required for document picker support; the web checks do not prove Android or AWS behavior.

## Usability pass

The primary tabs are Library, Search, Sources and Settings. First launch is empty; sample
records require an explicit demo action. Existing local imports and review state are kept.
Drive accounts and source-only previews use the signed backend routes; JSON imports remain
canonical records in the local saved library. The main UI never treats provider IDs as asset IDs.

See `docs/progress/2026-11-11-gallery-usability.md` at the repository root and the updated
browser checks in `tests/browser/`. Live AWS/OAuth and physical-device acceptance remain separate.
