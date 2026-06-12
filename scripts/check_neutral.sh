#!/bin/sh
# Neutrality gate. This is a generic, self-standing POC. A local-only term list lives in the
# gitignored _private/neutral_terms.txt (never committed); this script blocks a commit whose staged
# files contain any of those terms. If the term file is absent (fresh clone, CI), there is nothing
# to enforce and the gate is a no-op. POSIX sh only (husky runs under sh; macOS bash is 3.2).
set -eu

root=$(git rev-parse --show-toplevel)
terms="$root/_private/neutral_terms.txt"
[ -f "$terms" ] || exit 0

# build an alternation regex from the term file (one term per line; '#' comments + blanks ignored).
BANNED=$(grep -vE '^[[:space:]]*(#|$)' "$terms" | paste -sd '|' -)
[ -n "$BANNED" ] || exit 0

files=$(git diff --cached --name-only --diff-filter=ACM)
hits=""
OLDIFS=$IFS
IFS='
'
for f in $files; do
  m=$(git show ":$f" 2>/dev/null | grep -niE "$BANNED" || true)
  if [ -n "$m" ]; then
    hits="$hits
  $f:
$(echo "$m" | sed 's/^/    /')"
  fi
done
IFS=$OLDIFS

if [ -n "$hits" ]; then
  echo "commit blocked: disallowed names in staged files (see _private/neutral_terms.txt)." >&2
  echo "this is a generic POC — keep it neutral ('the originator', 'the platform')." >&2
  echo "$hits" >&2
  exit 1
fi
exit 0
