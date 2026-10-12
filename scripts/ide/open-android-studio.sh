#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
exec /opt/android-studio/bin/studio "$PROJECT_ROOT/apps/gallery/android"
