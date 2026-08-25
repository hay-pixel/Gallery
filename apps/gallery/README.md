# Ollamabinsaden Gallery

Mobile-first Expo 54/React Native migration of PixelDrive. It preserves Home, Images, deterministic Search, Library, Sources, Reviews, local category/review decisions, and the secure read-only Google Drive source browser.

Canonical catalogue records are keyed by ingest `asset_id` (`sha256:<digest>`) and contain all source occurrences. Exact identical bytes appear once; filenames, archive members, and Drive file IDs are provenance—not asset identity. Live Drive listings remain a separate source view until Ingest creates canonical records.

## Commands

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
