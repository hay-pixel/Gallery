#!/usr/bin/env bash
set -euo pipefail
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENDPOINT="${1:-${EXPO_PUBLIC_API_BASE_URL:-}}"
if [[ $# -gt 0 ]]; then shift; fi
if [[ -n "$ENDPOINT" && ! "$ENDPOINT" =~ ^https://[^/]+/?$ ]]; then
  echo "Expected the operator's HTTPS service origin." >&2
  exit 1
fi
if ! command -v lim >/dev/null; then
  echo "Install the Android remote builder with: npm install --global lim" >&2
  exit 1
fi
# Use an isolated app workspace so Limrun cannot select the repository parent.
BUILD_WORKSPACE="$(mktemp -d /tmp/gallery-native-build.XXXXXX)"
python3 - "$REPO_ROOT/apps/gallery" "$BUILD_WORKSPACE" <<'PY'
import shutil,sys
shutil.copytree(sys.argv[1],sys.argv[2],dirs_exist_ok=True,ignore=shutil.ignore_patterns('node_modules','.expo','android','ios','dist','web-dist','android-dist','.git','.env','*.log'))
PY
# Keep the local native module's Android source; copytree's global android ignore
# above excluded it as well as generated output.
cp -R "$REPO_ROOT/apps/gallery/modules" "$BUILD_WORKSPACE/"
cd "$BUILD_WORKSPACE"
lim gradle build . --expo-app-dir . --task assembleRelease \
  --env "EXPO_PUBLIC_API_BASE_URL=$ENDPOINT" \
  --env "NODE_ENV=production" \
  --upload com.ollamabinsaden.gallery/gallery-phone-test.apk "$@"
