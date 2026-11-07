#!/usr/bin/env bash
# ==============================================================================
# mount-ebs.sh: Mount persistent EBS data volume for Gallery on EC2
# Target Region: ap-southeast-2 (Sydney)
# Project Profile: ollamabinsaden
# ==============================================================================
set -euo pipefail

MOUNT_POINT="/var/lib/gallery"
DEVICE="${1:-/dev/nvme1n1}"
SERVICE_USER="gallery"

echo "==> Setting up Gallery EBS storage on ${DEVICE} at ${MOUNT_POINT}..."

if [ ! -b "${DEVICE}" ]; then
  echo "ERROR: Device ${DEVICE} does not exist. Check attached EBS volume." >&2
  exit 1
fi

# Format with ext4 if no filesystem exists
if ! blkid "${DEVICE}" >/dev/null 2>&1; then
  echo "==> Formatting ${DEVICE} with ext4..."
  mkfs.ext4 -L gallery-data "${DEVICE}"
fi

# Create mount point
mkdir -p "${MOUNT_POINT}"

# Mount volume
if ! mountpoint -q "${MOUNT_POINT}"; then
  echo "==> Mounting ${DEVICE} to ${MOUNT_POINT}..."
  mount "${DEVICE}" "${MOUNT_POINT}"
fi

# Ensure fstab entry exists for persistence across reboots
UUID=$(blkid -s UUID -o value "${DEVICE}")
if ! grep -qs "${UUID}" /etc/fstab; then
  echo "UUID=${UUID} ${MOUNT_POINT} ext4 defaults,nofail 0 2" >> /etc/fstab
  echo "==> Added ${UUID} to /etc/fstab"
fi

# Ensure directories exist with correct permissions
mkdir -p \
  "${MOUNT_POINT}/analysis" \
  "${MOUNT_POINT}/ollama/models" \
  "${MOUNT_POINT}/uploads"

if id "${SERVICE_USER}" >/dev/null 2>&1; then
  chown -R "${SERVICE_USER}:${SERVICE_USER}" "${MOUNT_POINT}"
  chmod 750 "${MOUNT_POINT}"
fi

echo "==> EBS storage setup complete. Current usage:"
df -h "${MOUNT_POINT}"
