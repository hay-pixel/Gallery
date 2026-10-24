# Gallery with Ollama

Standalone universal file library: authorized sources, unified catalogue, browse/review, visual analysis, search, and grounded questions using private Ollama inference.

## Current status

Gallery 1.1.0 indexes selected phone folders locally, preserves manual tags, supports metadata search/sorting, and uses an operator-configured service origin. Users do not enter a server or Ollama URL. The Drive handoff records a remote native build and emulator checks; this VM independently verified the downloaded APK and reran the app and Python suites. Physical-phone and hosted-service acceptance remain pending. See [the client release handoff](docs/CLIENT-RELEASE-HANDOFF.md) and [the prepared IDE handoff](docs/IDE-HANDOFF.md).


The Expo/React Native + Node app, read-only Google Drive OAuth, image-v1 Analysis, visual Search, and Analysis→Search bridge are migrated. Full metadata/semantic/hybrid Search, real catalogue integration, and the Ollama adapter remain unfinished. `services/ollama` currently holds documentation, not a completed runtime.

## Layout

- `apps/gallery/`: frontend, Node backend, OAuth, MySQL migrations, app tests.
- `services/analysis/`: Python classification, optional OCR, immutable results/features.
- `services/search/`: Python/SQLite/NumPy visual retrieval.
- `services/ollama/`: planned project-owned adapter/tools.
- `contracts/`: pinned asset JSON Schema and source/version manifest.
- `docs/contracts/`: accepted Analysis, VisualFeature, Search, Query, Ollama contracts.
- `tests/`: integration/evaluation; `deploy/aws/`: deployment plan.

## Independence and source model

Gallery must connect at least one authorized source and provide a usable library without Extract or Assist. Google Drive, local collections, and future OneDrive/device adapters are peers. Extract output is an optional source.

Use connector → source occurrence → canonical asset/catalogue record. Preserve originals, source identity/location, and every occurrence. Byte hashes prove exact duplicates; visual scores only suggest related content. Preserve user corrections across re-analysis. Metadata-only entries must remain unverified until byte identity is established.

Gallery owns its catalogue, annotations, Analysis, Search, and Ollama orchestration. No sibling-repo code imports or shared writable application database.

## Node setup

For Codex desktop setup scripts and worktree actions, see [Codex environment setup](docs/CODEX-ENVIRONMENT.md).

Node 22+, pnpm 9.12.0:

```bash
cd apps/gallery
corepack pnpm install --frozen-lockfile
corepack pnpm check
corepack pnpm test
corepack pnpm build
corepack pnpm dev
```

The build command builds the Node server, not Expo/native release artifacts. Validate web export and native builds separately. Use `corepack pnpm exec eslint .` for the reproducible CI lint check; `corepack pnpm lint` uses Expo's wrapper, which can attempt dependency setup. Five inherited warnings remain; the OAuth environment-access lint error was fixed during migration.

Copy `.env.example` to ignored `.env`. Server settings: MySQL `DATABASE_URL`, `JWT_SECRET`, `GOOGLE_DRIVE_OAUTH_CLIENT_ID`, `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, `GALLERY_WEB_RETURN_ORIGINS`, `PORT`. Public settings: `EXPO_PUBLIC_API_BASE_URL`, `EXPO_PUBLIC_GALLERY_RETURN_ORIGIN`; never place secrets in public variables.

Inject DATABASE_URL and run `corepack pnpm exec drizzle-kit migrate`. Apply reviewed migrations; do not regenerate schema as routine setup.

## Drive OAuth

Use a dedicated Google Web OAuth client. Register exact `<API-origin>/api/google-drive/callback`; web return is `<Gallery-origin>/oauth/drive`. Localhost callbacks require browser access to local/forwarded ports. Testing mode requires designated test users.

The app requests `drive.readonly`, encrypts refresh tokens server-side, and isolates source ownership through signed sessions. JWT_SECRET protects saved tokens too; plan rotation/migration rather than changing it casually. Cross-device account recovery remains pending. ChatGPT's Drive connection cannot replace app OAuth.

Temporary monorepo .env, uploaded client JSON, MySQL state, and all credentials were excluded from the split. Configure this checkout through secure runtime injection.

## Python setup

Python 3.12, from repository root:

```bash
python3.12 -m venv .venv
. .venv/bin/activate
python -m pip install -e 'services/analysis[test]' -e 'services/search[test]'
pytest services/analysis/tests services/search/tests tests/integration
```

Tests use fixture backends. Real model verification needs dependencies/cache in `services/analysis/README.md`. Baseline ResNet-18 provides classifier tags and embeddings, not general object detection/captioning. OCR is optional and requires Tesseract.

## Implementation milestones

1. **Real catalogue:** source adapters, local collection import, Drive ingestion, ownership, checksums, pagination/media access, durable identity and provenance.
2. **Complete Search:** metadata filtering/pagination, semantic embedding lifecycle, hybrid ranking with component provenance, stable API, and missing/stale/incompatible states.
3. **Analysis integration:** durable jobs/retries, model revisions, immutable result history, preferred results, tags/OCR/features, truthful availability.
4. **Ollama:** health/capabilities, model selection, query interpretation, bounded retrieval tools, streaming grounded answers, real asset citations and exact provenance.
5. **Product UX:** browse, categories/albums/views, review overrides, duplicate/similarity workflows, source management, conversational discovery.
6. **AWS release:** frontend/API, private workers/Ollama, durable media/catalogue/index/model storage, deployed OAuth callbacks, backups and metrics.
7. **Acceptance:** independently connect a source; import Extract output; use real Analysis/Search/Ollama; restart; verify provenance, annotations, persistence, and degraded behavior.

Basic browse and deterministic search must work without Ollama. Raw port 11434 stays private. Clients call Gallery's backend; model/web keys stay server-side. Bound tools by schema, timeout, and result count; never invent asset citations.

## Extract compatibility

Extract owns the asset schema; `contracts/` pins the migrated v1 snapshot and exact source provenance. Upgrade from tagged releases and run compatibility tests. Collection v1 must define manifest/version, assets, all source occurrences, checksums, relative locators, and idempotent import. Map files into authorized Gallery storage rather than assuming Extract's absolute paths. File export/import comes first; authenticated API/object-storage transport can follow.

## AWS plan

Profile `ollamabinsaden`; selected Region `ap-southeast-2`. Initial candidate: EC2/Linux for Analysis/Search/Ollama, EBS for durable model/index state, separately served app/API. Evaluate S3 media and managed MySQL after cost/workload review. Confirm project service eligibility and CPU/RAM/GPU needs before provisioning. Use service roles and CI OIDC. No infrastructure was deployed by this split.

Independent repositories/releases can initially share a host, with separate identities, configuration, and storage. Assist remains optional.

## Migration evidence

Source `hay-pixel/Ollamabinsaden` at `dcef931fbe318df84a8ddf8cfc0c1e2cb06b5305`; filtered history retained. Existing Gallery README-only lineage is preserved. Other source lineages include `hay-pixel/Pixeldrive` and `hay-pixel/Privatedrive`; inspect unique later work before migrating it. Old handoffs are evidence, not current assignments.

See [migration results](docs/MIGRATION.md). [Extract](https://github.com/hay-pixel/Extractor) · [Assist](https://github.com/hay-pixel/Assist) · [Gallery](https://github.com/hay-pixel/Gallery).

## Gallery 1.1 client update (12 October 2026)

The Android client now indexes selected phone folders locally, supports persistent manual tags and metadata sorting/search, and uses a simplified light/dark interface. Phone file contents remain on-device. Hosting is configured by operators, with model choice from the curated server catalogue. See `docs/CLIENT-RELEASE-HANDOFF.md` for implemented behaviour, tests and native build/live-service limitations. Canonical ingestion, AI tagging and hosted inference remain separate backend milestones.
