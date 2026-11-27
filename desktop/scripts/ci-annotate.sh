#!/usr/bin/env bash
# Posts the end of a CI log as GitHub annotations, which are readable without signing in (job logs are not).
# Usage: ci-annotate.sh <title> <log file> [lines]
title="$1"
log="$2"
lines="${3:-60}"

# Annotations are one line: escape % and encode newlines as %0A.
encode() { sed -e 's/\r//g' -e 's/%/%25/g' | awk '{printf "%s%%0A", $0}'; }

if [ ! -f "$log" ]; then
  echo "::error title=${title}::No log at ${log}"
  exit 0
fi

errors=$(grep -iE "error|fail|ENOSPC|EACCES|cannot|not found|exited with|⨯|●|✕" "$log" | tail -n 30 | encode)
[ -n "$errors" ] && echo "::error title=${title} (error lines)::${errors}"
echo "::error title=${title} (last ${lines} lines)::$(grep -v '^[[:space:]]*$' "$log" | tail -n "$lines" | encode)"
exit 0
