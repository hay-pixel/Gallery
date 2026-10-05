# Gallery agent instructions

Read README.md, docs/MIGRATION.md, relevant subsystem contracts, and deploy/aws/README.md before implementation. README.md describes current implementation and remaining milestones; do not claim planned features exist.

Own independent source connectors, catalogue, Analysis, Search, and private Ollama. Extract export is one optional source. Preserve canonical identity, source occurrences, user overrides, and degraded behavior.

This standalone repository supersedes the historical monorepo planning pause for its assigned product. Old handoffs are evidence, not active assignments. Preserve tested behavior. Keep all credentials/runtime state outside Git. Use independent CI and record test evidence and remaining limitations.

AWS project profile: `ollamabinsaden`. Selected Region: `ap-southeast-2`. Agent Toolkit's service endpoint uses `us-east-1`; project resources use the selected Region. AWS replaces historical Azure deployment assumptions.

<!-- BEGIN AWS Agent Toolkit rules -->
undefined
<!-- END AWS Agent Toolkit rules -->
