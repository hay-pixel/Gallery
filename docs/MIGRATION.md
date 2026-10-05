# Standalone repository migration

Date: 2026-10-05. Source: https://github.com/hay-pixel/Ollamabinsaden at commit `dcef931fbe318df84a8ddf8cfc0c1e2cb06b5305`.

A fresh local clone was filtered to preserve relevant Git history. Commit IDs changed as expected when filtering paths. The original monorepo and its uncommitted AWS AGENTS.md changes were left intact. Existing standalone README-only repository commits were merged as ancestors; their product-independence intent is carried into the new root README.

No historical branches were deleted or force-pushed. Credentials, uploaded files, ignored environments, installed dependencies, runtime databases, and model caches were excluded. Old handoffs describe earlier work, not current ownership. AWS in `ap-southeast-2` is the selected deployment target; no application infrastructure has been provisioned.

Repository separation is complete locally; implementation milestones in README.md remain outstanding. A Git split does not prove the finished product or deployed acceptance.

## Scope

Gallery app and Analysis/Search/Ollama directories retained at their existing paths. Cross-service tests and accepted contracts retained. Asset JSON Schemas pinned under contracts/ with exact source/version manifest; Extract owns future releases.

Added standalone README, AGENTS, AWS plan, app environment template, and Node/Python CI. Fixed server OAuth configuration's inherited Expo lint error by explicitly reading the two allowed environment variables; behavior remains covered by existing tests.

## Verification

- Clean Python 3.12 install and Analysis/Search/integration suite: **73 passed**.
- Clean pnpm frozen-lockfile install; TypeScript check: passed.
- App suite: **22 passed**. No OAuth credentials are supplied in this checkout; the live credential probe's existing unconfigured path does not contact Google.
- ESLint: **0 errors, 5 inherited warnings**.
- Node server build: passed. Expo/native production builds and deployed browser OAuth consent were not verified.

Temporary OAuth credentials and database remain only in the original development checkout. The earlier live Google client validation does not constitute a signed-in user session in this new checkout.

## Next owner/deliverable

Implement real standalone source/catalogue ingestion, metadata/semantic/hybrid Search and stable API, then private Ollama grounding and UI integration. Prove use without Extract/Assist and degraded operation without Ollama.
