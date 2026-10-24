#!/usr/bin/env bash
# Ubuntu 24.04, ap-southeast-2. Reuses a host; creates no cloud resources.
set -euo pipefail
[[ "$EUID" -eq 0 ]] || { echo 'Run with sudo.' >&2; exit 1; }
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
[[ -f "$REPO_ROOT/apps/gallery/package.json" ]] || { echo 'Run from the complete Gallery source bundle.' >&2; exit 1; }
. /etc/os-release
[[ "$ID" == ubuntu && "$VERSION_ID" == 24.04 ]] || { echo 'This script supports Ubuntu 24.04 only.' >&2; exit 1; }
apt-get update
apt-get install -y ca-certificates curl gnupg build-essential mariadb-server nginx rsync openssl
id gallery >/dev/null 2>&1 || useradd --system --create-home --home-dir /home/gallery --shell /usr/sbin/nologin gallery
install -d -o gallery -g gallery -m 750 /opt/gallery /srv/gallery/state
install -d -o root -g gallery -m 750 /etc/gallery
if ! command -v node >/dev/null || [[ "$(node -p 'Number(process.versions.node.split(".")[0])')" -lt 22 ]]; then
  install -d -m 755 /etc/apt/keyrings
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor --yes -o /etc/apt/keyrings/nodesource.gpg
  echo 'deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_22.x nodistro main' > /etc/apt/sources.list.d/nodesource.list
  apt-get update
  apt-get install -y nodejs
fi
corepack enable
corepack prepare pnpm@9.12.0 --activate
systemctl enable --now mariadb
if [[ ! -f /etc/gallery/gallery.env ]]; then
  umask 077
  DB_PASS="$(openssl rand -hex 24)"
  mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS gallery_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS 'gallery_user'@'localhost' IDENTIFIED BY '${DB_PASS}';
ALTER USER 'gallery_user'@'localhost' IDENTIFIED BY '${DB_PASS}';
GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX, DROP, REFERENCES ON gallery_db.* TO 'gallery_user'@'localhost';
SQL
  cat > /etc/gallery/gallery.env <<ENV
NODE_ENV=production
HOST=127.0.0.1
PORT=3000
DATABASE_URL=mysql://gallery_user:${DB_PASS}@localhost:3306/gallery_db
JWT_SECRET=$(openssl rand -hex 32)
GOOGLE_DRIVE_OAUTH_CLIENT_ID=
GOOGLE_DRIVE_OAUTH_CLIENT_SECRET=
GALLERY_WEB_RETURN_ORIGINS=
ENV
  chown root:root /etc/gallery/gallery.env
  chmod 600 /etc/gallery/gallery.env
fi
# Keep configuration private; systemd reads the root-owned file.
# shellcheck disable=SC1091
set -a
. /etc/gallery/gallery.env
set +a
if [[ -z "${GOOGLE_DRIVE_OAUTH_CLIENT_ID:-}" || -z "${GOOGLE_DRIVE_OAUTH_CLIENT_SECRET:-}" ]]; then
  echo 'Host prepared. Set OAuth credentials in /etc/gallery/gallery.env, then rerun. API not started.' >&2
  exit 1
fi
if [[ "$REPO_ROOT" != /opt/gallery ]]; then
  rsync -a --exclude=node_modules --exclude=.git --exclude=.env --exclude=.venv --exclude=web-dist --exclude=dist "$REPO_ROOT/" /opt/gallery/
fi
chown -R gallery:gallery /opt/gallery
cd /opt/gallery/apps/gallery
runuser -u gallery -- corepack pnpm install --frozen-lockfile
# Apply checked-in migrations only. Any failure stops deployment.
runuser -u gallery --preserve-environment -- corepack pnpm exec drizzle-kit migrate
runuser -u gallery -- corepack pnpm build
install -m 644 /opt/gallery/deploy/aws/gallery-api.service /etc/systemd/system/gallery-api.service
systemctl daemon-reload
systemctl enable --now gallery-api
systemctl restart gallery-api
for attempt in $(seq 1 20); do
  if systemctl is-active --quiet gallery-api && curl --fail --silent http://127.0.0.1:3000/api/health | node -e 'let s="";process.stdin.on("data",x=>s+=x);process.stdin.on("end",()=>{try{process.exit(JSON.parse(s).ok===true?0:1)}catch{process.exit(1)}})'; then
    echo 'Gallery API health passed. Configure HTTPS Nginx and test Drive OAuth before release.'
    exit 0
  fi
  sleep 1
done
echo 'API health failed; inspect journalctl -u gallery-api.' >&2
exit 1
