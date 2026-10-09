# Project TODO

- [x] Inspect the complete Pixeldrive Android source and project-control documents to map all existing screen behaviours and missing dependencies.
- [x] Remove Google Studio-branded hardcoding from the mobile implementation and replace it with PixelDrive branding without changing the product’s visual direction.
- [x] Recreate the existing Home, Library, Search, Ask AI, Review, Duplicates, System, and detail-sheet flows in Expo.
- [x] Implement a local synthetic catalogue and persisted virtual organisation state that keeps all source records immutable.
- [x] Implement keyless deterministic catalogue retrieval for Ask AI, with grounded citations and no user-supplied GenAI API key.
- [x] Implement safe review, category, duplicate comparison, preferred-copy, and job-control interactions.
- [x] Generate and configure a unique PixelDrive mobile app icon and branding configuration.
- [x] Add deterministic unit tests for retrieval, filtering, categorisation, duplicate preference, and review state.
- [x] Validate TypeScript, linting, tests, and supported native-safe core flows.
- [x] Review completed work against the source design and deliver a checkpoint with a concise migration summary.
- [x] Replace the unsuitable placeholder app icon with an optimized PixelDrive archive icon and restore checkpoint readiness.
- [x] Restore the interrupted PixelDrive development server and confirm the preview health.
- [x] Compare the PixelDrive preview with the original dark mobile design and correct any material drift.
- [x] Simplify the primary navigation and reduce dashboard density for one-handed mobile use.
- [x] Add an Images-focused browsing destination with visual-first file cards.
- [x] Add multi-source Google Drive management and communicate the boundary between local source records and authenticated Drive linking.
- [x] Move Reviews and Duplicates into focused secondary screens and remove their dashboard prominence.
- [x] Clarify that the reported top typography issue was filter-chip clipping; retain the unaffected screen-header treatment.
- [x] Fix Android filter-chip label clipping and typography in the top horizontal category controls.
- [x] Add secure read-only Google OAuth for linking and listing multiple independent Drive sources.
- [x] Remove the broken template login dependency from Drive connection and launch Google OAuth directly.
- [x] Support multiple simultaneous linked Google Drive sources without source replacement.
- [x] Index and render linked Drive images, videos, and ordinary files as read-only previews.
- [ ] Integrate the Gallery with the accepted private Ollama and Search contracts after implementing/verifying executable APIs. Historical monorepo Gate 5/architect assignment requirements are superseded by the standalone root README and AGENTS.md.
- [x] Synchronize the selected Pixeldrive GitHub repository with the completed mobile source and reviewer-ready documentation.

## Standalone backend integration (current work)

- [x] Add Gallery-owned local collection ingestion, SHA-256 canonical identity, source occurrences, and persistent owner-scoped CLI listing.
- [x] Add catalogue schema/provenance/restart/failure tests and fixture Analysis/Search interoperability; wire setup and CI.
- [ ] Inspect the user-reported AWS Ubuntu backend and map its actual routes/authentication to the accepted contracts.
- [ ] Implement authenticated catalogue pagination and authorized media delivery.
- [ ] Wire a real-library client adapter; preserve canonical-ID review overrides and explicit unavailable states.
- [ ] Validate real Drive ingestion, deployed OAuth returns, durable restart, and native/device behavior.

The current app evaluation catalogue is not proof of live backend integration. See the root README for current priorities.
