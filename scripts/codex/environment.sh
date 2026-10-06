#!/usr/bin/env bash
set -euo pipefail
project_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$project_root"

require_command() {
  if ! command -v "$1" >/dev/null 2>&1; then
    printf 'Missing prerequisite: %s. See docs/CODEX-ENVIRONMENT.md.\n' "$1" >&2
    exit 1
  fi
}
require_node() {
  require_command node
  node -e 'if (Number(process.versions.node.split(".")[0]) < 22) { console.error("Node 22 or later is required."); process.exit(1); }'
}
prepare_python() {
  require_command uv
  if [[ ! -x .venv/bin/python ]]; then
    uv venv --python 3.12 .venv
  fi
  .venv/bin/python -c 'import sys; assert sys.version_info[:2] == (3, 12), "This project requires a Python 3.12 virtualenv"'
}

pnpm_run() {
  if command -v corepack >/dev/null 2>&1; then
    corepack pnpm "$@"
  elif command -v pnpm >/dev/null 2>&1; then
    pnpm "$@"
  else
    printf 'Install Corepack or pnpm 9.12.0. See docs/CODEX-ENVIRONMENT.md.\n' >&2
    exit 1
  fi
}
case "${1:-setup}" in
  setup)
    require_node
    prepare_python
    uv pip install --python .venv/bin/python -e 'services/analysis[test]' -e 'services/search[test]'
    cd apps/gallery
    if [[ "$(pnpm_run --version)" != "9.12.0" ]]; then
      printf 'Gallery requires pnpm 9.12.0.\n' >&2
      exit 1
    fi
    pnpm_run install --frozen-lockfile
    pnpm_run build
    printf 'Gallery dependencies and server build are ready. Real models/OAuth are configured separately.\n'
    ;;
  test)
    .venv/bin/python -m pytest services/analysis/tests services/search/tests tests/integration
    cd apps/gallery
    pnpm_run check
    pnpm_run exec eslint .
    pnpm_run test
    ;;
  build)
    cd apps/gallery
    pnpm_run build
    ;;
  dev)
    cd apps/gallery
    pnpm_run dev
    ;;
  *)
    printf 'Usage: bash scripts/codex/environment.sh {setup|test|build|dev}\n' >&2
    exit 2
    ;;
esac
