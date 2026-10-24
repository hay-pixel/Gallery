# Antigravity handoff

Use this prepared Gallery 1.1.0 Drive client as the current client baseline.
Read `AGENTS.md`, `README.md`, `docs/MIGRATION.md`, relevant subsystem
contracts, `deploy/aws/README.md`, `docs/CLIENT-RELEASE-HANDOFF.md`, and
`docs/IDE-HANDOFF.md` before changing code.

The immediate result is ready for source editing here and for opening
`apps/gallery/android` in Android Studio. This branch includes the Drive
source changes plus handoff documentation and `docs/source-comparison`.
Keep it isolated from separate backend development until reviewed.

For later backend implementation, inspect the separate GitHub catalogue
checkpoint and VM selective-port branch identified in `IDE-HANDOFF.md`.
Reconcile their unique work with this client deliberately. Preserve canonical
SHA-256 identity, source occurrences, manual overrides, provenance, and
useful behavior without Ollama. Phone metadata indexes do not establish
canonical byte identity. Model catalogue selection does not provide AI.

The hosted service origin is not yet supplied. Users must not enter server
or Ollama URLs. Keep phone originals local; hosted content analysis requires
an explicit user choice. Keep server/model secrets server-side. Raw Ollama
port 11434 remains private.

Record new test evidence and remaining limitations. Review deployment scripts
before execution and finish backend readiness before calling hosted release
complete. Physical-phone tests, Google consent, authenticated HTTPS,
database persistence, and actual inference remain separate acceptance gates.
