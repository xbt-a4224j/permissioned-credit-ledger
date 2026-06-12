#!/bin/sh
# Neutrality gate. This is a generic, self-standing POC — no real organization, product, or person
# may appear in committed files. Blocks a commit if any staged file contains a disallowed term.
# Runs in pre-commit (.husky/pre-commit) and is safe to run standalone: scripts/check_neutral.sh
# POSIX sh only (husky runs under sh; macOS bash is 3.2) — no arrays, no mapfile, no pipe-to-while.
#
# The disallowed terms are stored base64-encoded so this committed file does not itself contain the
# very names it exists to keep out of the repo. To add a term: decode, append "|term", re-encode:
#   printf '%s' "$(printf %s "<b64>" | openssl base64 -d)|newterm" | openssl base64 | tr -d '\n'
set -eu

ENC='REDACTEDfHNhcmFoam9ufHJlaWxseQ=='
BANNED=$(printf '%s' "$ENC" | openssl base64 -A -d)
# fail loud rather than silently match every line if the decode ever yields nothing.
[ -n "$BANNED" ] || { echo "check_neutral: term decode failed (empty pattern); aborting." >&2; exit 2; }

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
  echo "commit blocked: disallowed organization/product/person names in staged files." >&2
  echo "this is a generic POC — keep it neutral ('the originator', 'the platform')." >&2
  echo "$hits" >&2
  exit 1
fi
exit 0
