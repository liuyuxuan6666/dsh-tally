#!/usr/bin/env bash
# Mirror this repository into the Windows directory a DSH profile links the
# bundle from.
#
# The bundle has to be installed from a Windows-local path: DSH runs on Windows
# and a \\wsl.localhost UNC link does not resolve as a profile bundle. Keep the
# repository authoritative and this target a disposable mirror.
#
# Usage:
#   DSH_TALLY_DEPLOY='D:/path/to/dsh-tally' ./scripts/sync.sh
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="${DSH_TALLY_DEPLOY:-}"

if [ -z "$DST" ]; then
  cat >&2 <<'EOF'
error: set DSH_TALLY_DEPLOY to the Windows-side mirror directory.

  DSH_TALLY_DEPLOY='D:/path/to/dsh-tally' ./scripts/sync.sh

Then install that directory as a bundle:
  plugin_manager install_bundle target='D:\path\to\dsh-tally'
EOF
  exit 2
fi

mkdir -p "$DST"
tar --exclude=.git --exclude=node_modules -cf - -C "$REPO" . | tar -xf - -C "$DST"

echo "synced $REPO -> $DST"
