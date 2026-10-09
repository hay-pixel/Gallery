# Gallery builder instructions

Read and follow `AGENTS.md`, `README.md`, and the relevant `docs/contracts/`. The root README
contains current status and next backend integration tasks. `apps/gallery/todo.md` separates
historical completed UI work from current standalone integration work.

Preserve existing tested behavior, canonical SHA-256 asset identity, all source occurrences,
owner isolation, and review overrides. Sample UI records are evaluation data, not live imports.
`services/catalogue` currently exposes a trusted operator CLI, not an authenticated HTTP API.

The user reports an AWS Ubuntu backend host; inspect actual routes/authentication before
integrating it. Follow `deploy/aws/README.md`. Do not invent endpoints or claim a configured
API base URL completes the integration. Keep private workers/Ollama and credentials server-side.
Do not deploy, provision resources, merge, or expose services without user authorization.

Use `bash scripts/codex/environment.sh setup`, `test`, and `build` from the repository root.
New catalogue changes must also pass `ruff check services/catalogue` and
`mypy --strict services/catalogue/src` in the prepared Python environment. Record test
results and explicitly distinguish fixture, live-runtime, and native-device evidence.
