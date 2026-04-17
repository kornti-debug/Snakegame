#!/usr/bin/env bash
set -euo pipefail

# Snake Memory — SFTP deploy to the campus PaaS.
#
# One-time setup:
#   1. Install lftp:            sudo pacman -S lftp
#   2. Add creds to ~/.netrc (perms 0600):
#        machine node.ustp.cloud
#          login node-cc241070-11015
#          password <from-dashboard>
#   3. Set the PaaS "start command" in the campus dashboard to `npm start`.
#
# Usage:
#   npm run deploy        # full build + upload
#
# What this uploads (minimal production payload):
#   - root  package.json, package-lock.json
#   - packages/*/package.json
#   - packages/*/dist/**       (compiled output)
#   - packages/client/index.html, phone.html (entry points for vite build)
# What we skip:
#   - node_modules/            (the PaaS runs `npm install` on upload)
#   - packages/*/src/          (not needed at runtime; we ship built JS)
#   - .git, *.ts, *.tsbuildinfo, uploads/, dist .map files in prod (optional)

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

HOST="node.ustp.cloud"
USER="node-cc241070-11015"

echo "▶ Building all workspaces…"
npm run build

echo "▶ Uploading to $USER@$HOST via SFTP…"
lftp -u "$USER," "sftp://$HOST" <<'EOF'
set net:max-retries 3
set net:timeout 15
set mirror:use-pget-n 4
set sftp:auto-confirm yes

# Mirror only the production payload. `mirror -R` recurses up;
# --delete removes files on the remote that are gone locally so the
# server's tree matches exactly.
mirror -R --only-newer --parallel=4 \
  --exclude-glob-rx '^\.git/' \
  --exclude-glob 'node_modules/' \
  --exclude-glob-rx 'packages/[^/]+/src/' \
  --exclude-glob 'scripts/' \
  --exclude-glob 'docs/' \
  --exclude-glob '*.ts' \
  --exclude-glob '*.tsbuildinfo' \
  --exclude-glob '*.md' \
  --exclude-glob 'uploads/' \
  . /

quit
EOF

echo "✓ Deploy complete."
echo "  Health: https://cc241070-11015.node.ustp.cloud/health"
echo "  App:    https://cc241070-11015.node.ustp.cloud/"
