#!/usr/bin/env bash
# ==============================================================================
# deploy-to-ec2.sh: Push bundle from Linode to EC2 and execute installer
# Usage: ./deploy-to-ec2.sh <EC2_HOST_OR_IP> [SSH_KEY_PATH] [REMOTE_USER]
# ==============================================================================
set -euo pipefail

EC2_HOST="${1:-}"
SSH_KEY="${2:-}"
REMOTE_USER="${3:-ubuntu}"
BUNDLE_PATH="${BUNDLE_PATH:-}"
if [ -z "${BUNDLE_PATH}" ]; then
    if [ -f "/root/dist-backend/gallery-backend-bundle.tar.gz" ]; then
        BUNDLE_PATH="/root/dist-backend/gallery-backend-bundle.tar.gz"
    else
        SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
        BUNDLE_PATH="${SCRIPT_DIR}/../dist/gallery-backend-bundle.tar.gz"
    fi
fi

if [ -z "${EC2_HOST}" ]; then
    echo "Usage: $0 <EC2_HOST_OR_IP> [SSH_KEY_PATH] [REMOTE_USER (default: ubuntu)]"
    exit 1
fi

SSH_OPTS=("-o" "StrictHostKeyChecking=no")
if [ -n "${SSH_KEY}" ] && [ -f "${SSH_KEY}" ]; then
    SSH_OPTS+=("-i" "${SSH_KEY}")
fi

echo "==> [1/3] Copying deployment bundle to ${REMOTE_USER}@${EC2_HOST}:/tmp/..."
scp "${SSH_OPTS[@]}" "${BUNDLE_PATH}" "${REMOTE_USER}@${EC2_HOST}:/tmp/gallery-backend-bundle.tar.gz"

echo "==> [2/3] Extracting bundle on EC2..."
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${EC2_HOST}" "mkdir -p /tmp/gallery-deploy && tar -xzf /tmp/gallery-backend-bundle.tar.gz -C /tmp/gallery-deploy"

echo "==> [3/3] Running installer on EC2..."
ssh "${SSH_OPTS[@]}" "${REMOTE_USER}@${EC2_HOST}" "cd /tmp/gallery-deploy && sudo bash install-on-ec2.sh"

echo "==> Deployment to ${EC2_HOST} successfully triggered!"
