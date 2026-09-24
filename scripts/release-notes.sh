#!/usr/bin/env bash
# Print the CHANGELOG section for one version, as release notes.
#   scripts/release-notes.sh 1.5
# Exits non-zero if CHANGELOG.md has no section for it, so a release can't ship undocumented.
set -euo pipefail
v="$1"
body="$(awk -v v="$v" '
  index($0, "## [" v "]") == 1 { on = 1; next }
  on && /^## \[/ { exit }
  on && /^\[[0-9.]+\]: / { exit }
  on { print }
' CHANGELOG.md | sed -e '/./,$!d')"
if [ -z "$body" ]; then
  echo "CHANGELOG.md has no section for $v. Add one before tagging." >&2
  exit 1
fi
printf '%s\n\nFull history: [CHANGELOG.md](https://github.com/rrhinog/water-tracker/blob/main/CHANGELOG.md)\n' "$body"
