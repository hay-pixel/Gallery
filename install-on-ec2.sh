#!/usr/bin/env bash
# ==============================================================================
# install-on-ec2.sh: Gallery Backend + Ollama + Services Installer for EC2
# Target Region: ap-southeast-2 (Sydney) | AWS Profile: ollamabinsaden
# Run with: sudo bash install-on-ec2.sh [EBS_DEVICE (default: /dev/nvme1n1)]
# ==============================================================================
set -euo pipefail

EBS_DEV="${1:-/dev/nvme1n1}"
INSTALL_DIR="/opt/gallery"

echo "=========================================================="
echo " Starting Gallery Backend + Ollama Installation on EC2"
echo " Target directory: ${INSTALL_DIR}"
echo "=========================================================="

# 1. Update OS and install system dependencies
echo "==> [1/8] Installing host packages..."
export DEBIAN_FRONTEND=noninteractive
apt-get update -qq
apt-get install -y -qq curl git build-essential python3.12 python3.12-venv python3-pip \
    tesseract-ocr libtesseract-dev caddy jq mysql-server

# Install Node.js 22 & Corepack if missing
if ! command -v node >/dev/null 2>&1; then
    curl -fsSL https://deb.nodesource.com/setup_22.x | bash -
    apt-get install -y -qq nodejs
fi
corepack enable
corepack prepare pnpm@9.12.0 --activate

# Install Ollama if missing
if ! command -v ollama >/dev/null 2>&1; then
    echo "==> Installing Ollama daemon..."
    curl -fsSL https://ollama.com/install.sh | sh
fi

# 2. System user and EBS Mount
echo "==> [2/8] Setting up gallery user and EBS storage..."
if ! id -u gallery >/dev/null 2>&1; then
    useradd -r -s /bin/false -d /var/lib/gallery gallery
fi

if [ -b "${EBS_DEV}" ]; then
    bash deploy/aws/mount-ebs.sh "${EBS_DEV}"
else
    echo "WARNING: Block device ${EBS_DEV} not detected. Falling back to local directories in /var/lib/gallery."
    mkdir -p /var/lib/gallery/analysis /var/lib/gallery/ollama/models /var/lib/gallery/uploads
    chown -R gallery:gallery /var/lib/gallery
fi

# 3. Deploy application files
echo "==> [3/8] Deploying application files to ${INSTALL_DIR}..."
mkdir -p "${INSTALL_DIR}"
cp -r apps services deploy contracts pyproject.toml "${INSTALL_DIR}/" 2>/dev/null || cp -r apps services deploy contracts "${INSTALL_DIR}/"
chown -R gallery:gallery "${INSTALL_DIR}"

# 4. Set up Python virtual environment
echo "==> [4/8] Building Python virtual environment..."
if [ ! -d "${INSTALL_DIR}/.venv" ]; then
    python3.12 -m venv "${INSTALL_DIR}/.venv"
fi
"${INSTALL_DIR}/.venv/bin/pip" install --upgrade pip -q
"${INSTALL_DIR}/.venv/bin/pip" install -q \
    -e "${INSTALL_DIR}/services/analysis" \
    -e "${INSTALL_DIR}/services/search" \
    -e "${INSTALL_DIR}/services/ollama" \
    fastapi uvicorn pydantic

# 5. Set up Node.js server dependencies
echo "==> [5/8] Setting up Node.js server production dependencies..."
(
    cd "${INSTALL_DIR}/apps/gallery"
    pnpm install --prod --frozen-lockfile
)

# 6. Database and environment configuration
echo "==> [6/8] Configuring MySQL and environment..."
mkdir -p /etc/gallery
if [ ! -f /etc/gallery/gallery-web.env ]; then
    JWT_SECRET_GEN=$(head -c 32 /dev/urandom | xxd -p)
    cat << EOF > /etc/gallery/gallery-web.env
NODE_ENV="production"
PORT="3000"
DATABASE_URL="mysql://gallery:gallery_local_secret@127.0.0.1:3306/gallery"
JWT_SECRET="${JWT_SECRET_GEN}"
AI_GATEWAY_URL="http://127.0.0.1:8000"
EXPO_PUBLIC_API_BASE_URL="http://127.0.0.1:3000"
EXPO_PUBLIC_GALLERY_RETURN_ORIGIN="http://127.0.0.1:3000"
GALLERY_WEB_RETURN_ORIGINS="http://127.0.0.1:3000"
EOF
    chmod 600 /etc/gallery/gallery-web.env
    echo "Created default /etc/gallery/gallery-web.env (update with domain & OAuth secrets)."
fi

# Ensure MySQL database & user exist
mysql -e "CREATE DATABASE IF NOT EXISTS gallery CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;" || true
mysql -e "CREATE USER IF NOT EXISTS 'gallery'@'127.0.0.1' IDENTIFIED BY 'gallery_local_secret';" || true
mysql -e "GRANT ALL PRIVILEGES ON gallery.* TO 'gallery'@'127.0.0.1'; FLUSH PRIVILEGES;" || true

# Run database migrations
(
    cd "${INSTALL_DIR}/apps/gallery"
    DATABASE_URL="mysql://gallery:gallery_local_secret@127.0.0.1:3306/gallery" pnpm exec drizzle-kit migrate
)

# 7. Install systemd services
echo "==> [7/8] Installing and enabling systemd daemons..."
cp "${INSTALL_DIR}/deploy/aws/ollama.service" /etc/systemd/system/
cp "${INSTALL_DIR}/deploy/aws/gallery-ai.service" /etc/systemd/system/
cp "${INSTALL_DIR}/deploy/aws/gallery-web.service" /etc/systemd/system/

systemctl daemon-reload
systemctl enable --now ollama
systemctl enable --now gallery-ai
systemctl enable --now gallery-web

# 8. Pull required Ollama models
echo "==> [8/8] Pulling Ollama weights (llama3.2:3b, nomic-embed-text:v1.5)..."
sleep 2
ollama pull llama3.2:3b || echo "WARNING: Failed to pull llama3.2:3b, verify network or rerun later."
ollama pull nomic-embed-text:v1.5 || echo "WARNING: Failed to pull nomic-embed-text, verify network or rerun later."

echo "=========================================================="
echo " Gallery EC2 Backend Deployment Complete!"
echo " Services status:"
systemctl is-active ollama gallery-ai gallery-web
echo " Verification: curl http://127.0.0.1:8000/health"
echo "=========================================================="
