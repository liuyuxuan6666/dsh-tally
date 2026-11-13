#!/usr/bin/env bash
# Mirror this repo into the Windows directory that DSH installs the bundle from.
#
# The repository lives in WSL, but DSH runs on Windows and needs a local path to
# link the bundle from (a \\wsl.localhost UNC link does not resolve as a profile
# bundle). Keep the WSL copy authoritative and this one a disposable mirror.
set -euo pipefail

REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
DST="${DSH_TALLY_DEPLOY:-/mnt/c/Users/user/Documents/deepseek-harness/default-workspace/dsh-tally}"

mkdir -p "$DST"
tar --exclude=.git --exclude=node_modules -cf - -C "$REPO" . | tar -xf - -C "$DST"

echo "synced $REPO -> $DST"
echo "next: plugin_manager install_bundle target=$DST"
