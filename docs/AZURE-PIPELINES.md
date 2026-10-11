# Azure DevOps CI

The canonical source is `hay-pixel/Gallery` on GitHub. `azure-pipelines.yml` builds main pushes and pull requests into main in the existing Ollamabinsaden Azure DevOps organization. Each app owns its pipeline and outputs; Azure Repos copies are historical snapshots rather than the ongoing source of truth.

Use the run Summary to download published pipeline artifacts and the Tests tab for JUnit results. The Azure Artifacts package feed is optional and is not required to download these outputs. No personal access token or deployment credentials are required in the repository.

CI checks Analysis/Search/integration tests, app types/lint/tests, the Node server bundle, and the Expo static web export. The web client directly declares the pinned CSS interop runtime required by NativeWind-generated JSX imports under pnpm.

Outputs are `gallery-server` and `gallery-web`. Real Drive consent, a configured database, real model execution, and unfinished catalogue/Ollama features need separate product acceptance.
