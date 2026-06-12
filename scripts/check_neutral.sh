#!/bin/sh
# Company-neutrality gate. This is a generic, self-standing POC — no real company, product, or
# person may appear in committed files. Blocks a commit if any staged file contains a banned term.
# Runs in pre-commit (.husky/pre-commit) and is safe to run standalone: scripts/check_neutral.sh
# POSIX sh only (husky runs under sh; macOS bash is 3.2) — no arrays, no mapfile, no pipe-to-while.
set -eu

# case-insensitive banned terms (extended regex). Add new ones here.
BANNED='the originator|the platform|the partner|redacted|redacted'

files=$(git diff --cached --name-only --diff-filter=ACM)
hits=""

OLDIFS=$IFS
IFS='
'
for f in $files; do
  # skip this script itself (it legitimately names the terms).
  [ "$f" = "scripts/check_neutral.sh" ] && continue
  m=$(git show ":$f" 2>/dev/null | grep -niE "$BANNED" || true)
  if [ -n "$m" ]; then
    hits="$hits
  $f:
$(echo "$m" | sed 's/^/    /')"
  fi
done
IFS=$OLDIFS

if [ -n "$hits" ]; then
  echo "commit blocked: company/product/person names are not allowed in this repo." >&2
  echo "this is a generic POC — keep it neutral ('the originator', 'the platform')." >&2
  echo "$hits" >&2
  exit 1
fi
exit 0
