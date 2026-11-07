#!/usr/bin/env bash
# Gallery with Ollama AWS Host Bootstrap Script (ap-southeast-2)
# Usage: sudo bash deploy/aws/bootstrap.sh

set -euo pipefail

echo "==> [1/6] Creating gallery system user and directories..."
if ! id -u gallery >/dev/null 2>&1; then
    useradd -r -s /bin/false -d /var/lib/gallery gallery
fi

mkdir -p /var/lib/gallery/analysis /var/lib/gallery/uploads /var/lib/gallery/ollama/models /etc/gallery
chown -R gallery:gallery /var/lib/gallery

echo "==> [2/6] Verifying Node.js, Python, and Ollama prerequisites..."
command -v node >/dev/null 2>&1 || (echo "Node.js 22+ is required" && exit 1)
command -v python3 >/dev/null 2>&1 || (echo "Python 3.12+ is required" && exit 1)

echo "==> [3/6] Setting up Python virtualenv..."
if [ ! -d ".venv" ]; then
    python3 -m venv .venv
fi
.venv/bin/pip install --upgrade pip
.venv/bin/pip install -e 'services/analysis[test]' -e 'services/search[test]' -e 'services/ollama[test]'

echo "==> [4/6] Building Node application and migrations..."
(
    cd apps/gallery
    corepack pnpm install --frozen-lockfile
    corepack pnpm check
    corepack pnpm build
)

echo "==> [5/6] Installing systemd service units..."
cp deploy/aws/ollama.service /etc/systemd/system/
cp deploy/aws/gallery-ai.service /etc/systemd/system/
cp deploy/aws/gallery-web.service /etc/systemd/system/

systemctl daemon-reload

echo "==> [6/6] Bootstrap complete!"
echo "Next steps:"
echo "1. Configure /etc/gallery/gallery-web.env with DATABASE_URL and secrets."
echo "2. Run database migrations: cd apps/gallery && corepack pnpm exec drizzle-kit migrate"
echo "3. Start services:"
echo "   sudo systemctl enable --now ollama"
echo "   sudo systemctl enable --now gallery-ai"
echo "   sudo systemctl enable --now gallery-web"

