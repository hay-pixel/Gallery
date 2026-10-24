#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec /opt/antigravity-ide/bin/antigravity-ide --new-window "$PROJECT_ROOT/Gallery.code-workspace" "$PROJECT_ROOT/docs/ANTIGRAVITY-TASK.md"
