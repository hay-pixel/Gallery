# Gallery start checkpoint — 2026-10-09

## Inspected baseline

Clean checkout at f513a5a. Read AGENTS.md, root/app READMEs, migration and environment
instructions, AWS plan, app TODO, pinned asset/occurrence schemas, Search and Analysis
contracts, recent changes, CI, source code, and tests. Historical integration gates do
not supersede the standalone repository requirements.

Existing Expo UI uses an evaluation catalogue; Drive browsing has signed session ownership
and encrypted credentials. Analysis and visual Search have fixture-backed tests. Real app
catalogue integration, full Search, and Ollama runtime remain unfinished. No dependencies,
credentials, database, or model runtime were prepared in this execution workspace.

After the documented setup: 73 Python tests and 22 app tests passed; TypeScript passed;
ESLint had zero errors and five inherited warnings; Node server build passed.

## Implemented milestone slice

Added services/catalogue: trusted local directory import, copied content-addressed blobs,
SQLite canonical records/source occurrences, owner-scoped paginated listing, and an operator
CLI. Exact byte duplicates share identity without losing occurrences. Re-imports preserve
first observations; changed source bytes preserve historical assets. Imports skip symlinks
and special files and roll back metadata on failure. Source IDs cannot silently change roots.
No original source data, UI fixture state, annotations, shared schema, or sibling app changed.

Setup and independent CI now install/test the catalogue; CI also checks its lint and typing.
The service README documents operator usage, security boundary, storage semantics, and limits.

## Evidence

- Combined Python suite: 83 passed (73 existing + 9 catalogue + 1 new integration).
- New service: Ruff passed, strict mypy passed, both pinned JSON Schemas validated.
- CLI subprocess tests prove import then listing in a separate process and canonical byte access.
- Real imported images feed existing Analysis and visual Search contracts after source deletion;
  inference uses a deterministic fixture backend, not a real trained model.
- Production Node server started locally; /api/health and /api/trpc/health both returned ok=true.
  Temporary process was stopped. This proves API health only, not OAuth or frontend behavior.
- Shell syntax and git diff whitespace checks passed.

## Execution assessment and handoff

Cloud is sufficient for implementation, dependency setup, local collection persistence/restart
tests, fixture model integration, and the API smoke check. No Remote executor is attached;
there is no need to switch for this slice. Runtime status reports no secrets or outbound
identities. HTTP policy is restricted (subsequently observed enforced); no assumption of provider
access is made.

Remaining exact dependencies:

- Real collection acceptance: provide an authorized readable collection mount and durable,
  access-controlled state directory. Current tests use temporary data. A persistent host must
  retain catalogue.sqlite and blobs together, provide disk capacity/backups, and survive restart.
- Live Drive: configure MySQL DATABASE_URL, JWT_SECRET, dedicated Google Web OAuth client ID
  and secret, reviewed database migrations, approved Gallery return origins, registered exact
  API callback URI, and a consent-capable browser/test user. None are configured here.
- Real inference: install Torch/torchvision and approved cached weights; optional OCR needs
  Tesseract. Ollama adapter remains unimplemented and a private runtime/model selection is pending.
  Persistent CPU/RAM/GPU sizing and model/index storage need workload evidence before provisioning.
- Mobile acceptance: no Android/iOS simulator or device was used. A suitable Remote/native host
  or physical device must verify secure storage, OAuth return links, media, and user interactions.
  Native release builds and Expo web UI behavior were not verified by these checks.

Next implementation: authenticated paginated catalogue/media backend operations, then an
explicit real-library UI mode preserving existing review overrides and degraded browsing.
The CLI owner selector is not authentication and must not be exposed directly over HTTP.

The user subsequently authorized preserving and pushing this development checkpoint for other
builders. Root/app READMEs, the active TODO, agent instructions, Copilot instructions, and AWS
guidance now reflect the user-reported AWS Ubuntu backend host and the missing integration
boundary. Host deployment, endpoints, and compatibility have not been verified. The checkpoint
will be committed on `gallery/catalogue-checkpoint`; pushing source is not app deployment.
No cloud resources were provisioned and no application deployment or merge was performed.
