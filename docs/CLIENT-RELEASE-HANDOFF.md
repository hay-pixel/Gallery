# Gallery 1.1.0 — local indexing and streamlined client

Date: 2026-10-12, Australia/Brisbane. Supersedes the earlier client handoff.

## Accepted product requirements

Gallery is a hosted product. We provide the server, runtime hosting, and curated/customised Ollama models. Users authorise Google Drive and choose an operator-approved model. There is no user-entered server or Ollama URL. The service origin is operator build configuration (`EXPO_PUBLIC_API_BASE_URL`). A deployment origin has not yet been supplied in this workspace; do not invent one or mark hosted integration complete.

Local sync means indexing selected phone folders while file contents stay on the phone. This release has no file-upload action and makes no hosted AI request containing phone file contents.

## Implemented

- Library, Search, Settings navigation, white/light default, persisted Dark and System options, restrained teal accents, simplified copy and rows.
- Bottom navigation reserves real Android safe-area insets; file details reserve all safe edges and scroll.
- Android-only local Expo module (`modules/gallery-local-index`) uses ACTION_OPEN_DOCUMENT_TREE, persists read permission, accepts internal/SD storage folders, and traverses child metadata on a worker queue. It never reads file contents during indexing or sends metadata/files to a server.
- Filename, MIME type, byte size, modification time, source identity and relative path are indexed. Entries remain source occurrences, not verified canonical assets. No byte hash is claimed.
- Rescan on app opening/foreground return and manual refresh. No background service is promised. A scan caps files and directories at 20,000 and reports partial results; interrupted/unreadable/partial scans retain unmatched cached records. Complete scans remove deleted occurrences.
- Private atomic on-device index storage avoids Android AsyncStorage single-row size limits. Folder removal revokes the read grant and removes its displayed index, not original files.
- Open local files using an installed viewer. Image previews use local content URIs.
- Sort by Name, Date (newest first), Size (largest first), Type; filter Phone/Drive and tags; search names, descriptions, paths, source names and manual tags.
- Tags are editable in file details and persisted on the device; rescanning preserves edits by source occurrence key. Tags are not synchronised across devices.
- Google Drive read-only OAuth, scoped sessions, grant refresh and offline metadata fallback retained. Expiring media grants are excluded from persisted Drive metadata.
- Old user-entered server preferences are ignored. Operators own the deployment configuration.
- Session-protected `hosted.models` returns only the operator catalogue in `GALLERY_APPROVED_MODELS_JSON`, shaped as `[{"id":"operator-model-id","name":"Display name","description":"Model purpose"}]`. Empty/unconfigured/malformed lists return no models. Private hosts/secrets are stripped. Selection is persisted; unavailable selections are labelled. No models were invented or downloaded.
- Android version is 1.1.0, versionCode 2.

## Backend work for Gemini

1. Deploy a stable authenticated HTTPS origin and pass that origin into the APK build. Provide Google OAuth client configuration and permitted return origins. Users do not enter a URL.
2. Implement curated model runtime availability and grounded inference behind the Gallery API. The model catalogue/selection alone is not inference. AI tagging and answers remain unavailable.
3. Implement durable canonical catalogue ingestion, verified SHA-256 identity and all source occurrences; Drive metadata alone is not canonical ingestion.
4. Integrate Analysis/Search workers and real semantic/hybrid/visual search. Local metadata search and manual tagging work independently.
5. Add stable account/session recovery and server annotation sync. Existing anonymous sessions cannot recover older links after token expiry.
6. Any future hosted analysis of local content must require an explicit user choice before transmission. This build performs metadata indexing only.

## Build and checks

- TypeScript passed.
- 37 app tests passed, including partial/full rescans, source identity, tag search/sorting and curated model metadata boundaries.
- Changed UI and connector files passed ESLint.
- Node API bundle built.
- Expo web and Android JavaScript exports passed. These are not proof of native compilation.
- Browser smoke checks passed at 390x844, 360x640 and desktop: light/dark display, persisted appearance/tags, metadata/tag search, absence of server-input UI and visible navigation bounds. Browser tests use supplied local metadata fixtures; native SAF is not exercised by these tests.
- Local Expo module was resolved by Android autolinking.
- Native 1.1.0 APK compilation passed on Limrun: build-1791796312208912638, instance gradle_euna_01m4qms2bde2mt61ygnc5kx982. Final follow-up build reported BUILD SUCCESSFUL in 19 seconds using the prior full build cache. Native module compilation also passed.
- APK: 93,138,866 bytes; SHA-256 `f2ab9fb9acf0505960c877e13585d8e80e60676ef1963bcc5f50e95765185472`; ZIP integrity and downloaded asset MD5 matched.

Native emulator acceptance passed: APK version 1.1.0/versionCode 2 installed; real Android folder picker/persistent read grant; recursive indexing; local image previews; two independent folders added with immediate indexing; manual tag editing/search; tags retained after replacing the installed APK; complete rescan removed a deleted nested file; Name/Size order changed correctly; System appearance followed live OS dark/light changes; light/gesture and dark/three-button navigation kept all controls above the system bar. Final APK signing certificate matches the previously delivered 1.0 APK, preserving signing compatibility. Screens used verification fixtures only, not user data.

Remaining acceptance: verify on the physical Samsung phone, permission-revocation fallback on device, opening files in third-party viewers, live Google consent, hosted model catalogue/inference and production HTTPS. Google/hosted AI remain unavailable until operators deploy/configure the service origin and runtime. No service origin has been invented or entered by users.

## Build command

`PATH=/path/to/lim/bin:$PATH bash android/build-client.sh https://operator-hosted-origin`

The script copies the app into an isolated build workspace (including local native module sources) before invoking Limrun. Never compile the generated Android project locally. Leaving the origin empty supports phone-index testing but does not enable Google/hosted service connections.
