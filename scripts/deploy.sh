#!/usr/bin/env bash
# Builds Discours for a sub-path and installs it into a folder of static apps.
#
# Usage:
#   npm run deploy -- /path/to/apps      # installs into /path/to/apps/discours
#   DEPLOY_DIR=/path/to/apps npm run deploy
#
# The destination can also be set once in a git-ignored `.deploy.local` file at the project root:
#   DEPLOY_DIR=/path/to/apps
#
# BASE_PATH sets the public path the app is served from (default: /apps/discours/).
# The script only copies files; publishing the destination is up to you.
set -euo pipefail

APP="discours"

cd "$(dirname "$0")/.."

# shellcheck source=/dev/null
[ -f .deploy.local ] && source .deploy.local

BASE="${BASE_PATH:-/apps/${APP}/}"
APPS_DIR="${1:-${DEPLOY_DIR:-}}"

if [ -z "$APPS_DIR" ]; then
  echo "error: no destination. Pass a folder (npm run deploy -- /path/to/apps)," >&2
  echo "       set DEPLOY_DIR, or define it in .deploy.local." >&2
  exit 1
fi
if [ ! -d "$APPS_DIR" ]; then
  echo "error: destination folder not found: $APPS_DIR" >&2
  exit 1
fi
TARGET="${APPS_DIR%/}/${APP}"

echo "› Building with base ${BASE}"
BASE_PATH="$BASE" npm run build

echo "› Installing into ${TARGET}"
mkdir -p "$TARGET"
# --delete removes files from previous builds (old hashed assets).
rsync -a --delete dist/ "$TARGET/"

# Apache: serve index.html for the app's routes (e.g. ${BASE}texte).
# Static hosts without per-folder rewrites (GitHub Pages) need a 404.html redirect instead,
# see the restore script at the top of index.html.
cat > "$TARGET/.htaccess" <<EOF
RewriteEngine On
RewriteBase ${BASE}
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . ${BASE}index.html [L]
EOF

echo "✓ Installed $(du -sh "$TARGET" | cut -f1) in ${TARGET}"
