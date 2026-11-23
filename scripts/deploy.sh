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

readonly APP="discours"
readonly LOCAL_CONFIG=".deploy.local"

# Prints an error and stops.
fail() {
  local line
  for line in "$@"; do echo "$line" >&2; done
  exit 1
}

# The folder of apps to install into: the first argument, else DEPLOY_DIR.
apps_dir() {
  local dir="${1:-${DEPLOY_DIR:-}}"
  [ -n "$dir" ] || fail \
    "error: no destination. Pass a folder (npm run deploy -- /path/to/apps)," \
    "       set DEPLOY_DIR, or define it in ${LOCAL_CONFIG}."
  [ -d "$dir" ] || fail "error: destination folder not found: $dir"
  echo "${dir%/}"
}

# Builds the app into dist/, served from the public path $1.
build() {
  local base="$1"
  echo "› Building with base ${base}"
  BASE_PATH="$base" npm run build
}

# Copies dist/ into $1, removing files from previous builds (old hashed assets).
install() {
  local target="$1"
  echo "› Installing into ${target}"
  mkdir -p "$target"
  rsync -a --delete dist/ "$target/"
}

# Writes the Apache rules that serve index.html for the app's routes (e.g. ${base}texte).
# Static hosts without per-folder rewrites (GitHub Pages) need a 404.html redirect instead,
# see the restore script at the top of index.html.
write_htaccess() {
  local target="$1" base="$2"
  cat > "$target/.htaccess" <<EOF
RewriteEngine On
RewriteBase ${base}
RewriteRule ^index\.html$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . ${base}index.html [L]
EOF
}

main() {
  cd "$(dirname "$0")/.."
  # shellcheck source=/dev/null
  if [ -f "$LOCAL_CONFIG" ]; then source "$LOCAL_CONFIG"; fi

  local base="${BASE_PATH:-/apps/${APP}/}"
  local target
  target="$(apps_dir "${1:-}")/${APP}"

  build "$base"
  install "$target"
  write_htaccess "$target" "$base"
  echo "✓ Installed $(du -sh "$target" | cut -f1) in ${target}"
}

main "$@"
