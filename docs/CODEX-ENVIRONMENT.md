# Codex local/worktree environment

These instructions configure the screen under Codex Settings → Worktrees → Local environments. They apply to this repository alone, not /workspace as an umbrella project.

## Prerequisites

Bash, uv, Node 22+, and Corepack or pnpm 9.12.0. Python tests use fixture backends; setup does not download Torch models, install Ollama, or create MySQL.

The scripts support Linux/macOS Unix environments. They are not native PowerShell scripts. On Windows, use a WSL2 project/terminal; do not paste Bash into the Windows PowerShell override. Windows-native Extract/Gallery setup can instead use the individual commands in the root README, but that path has not been verified here.

## Fields to enter

- **Name:** Gallery development
- **Setup script** (Default for Unix, or Linux override):
  `bash scripts/codex/environment.sh setup`
- **Cleanup script:** leave empty. No automatic deletion, database removal, shared-service shutdown, or tmux cleanup is needed.
- **Test action:** `bash scripts/codex/environment.sh test`
- **Build action:** `bash scripts/codex/environment.sh build`

- **Dev**: `bash scripts/codex/environment.sh dev` (requires app-specific configuration for live sources).

Select the repo root as the Codex project, save the environment, and use that environment when creating its worktrees. Commands resolve the repository root from their own location and do not rely on /workspace paths or sibling checkouts.

The app generates its .codex configuration when you click Save. This change provides the scripts and exact field values; it does not claim that the desktop settings have already been saved. Avoid guessing the generated configuration schema or overwriting another environment's settings.

## What setup does

Installs only this product's development dependencies and, for Node apps, builds the existing server/application. It is safe to rerun without wiping local runtime data. Tests are separate actions, so new worktrees are not blocked by live provider authentication.

Secrets are not copied from another checkout. Supply private .env/runtime settings separately; see the root README. AWS login is machine/profile state outside Git, not something to automate in every worktree setup. Setup creates no AWS resources and does not deploy an application.

Ollama, Google OAuth, real model caches, production databases, and authenticated agent CLIs are separate runtime setup steps. The Test action proves the development baseline, not live deployment readiness.

## Desktop versus this workspace

The scripts are prepared in this remote workspace. If your desktop project is a different checkout, it needs these files before the commands will work. Saving in the desktop UI is still a user step. Local environments and their generated .codex files are documented at https://developers.openai.com/codex/app/local-environments/.
