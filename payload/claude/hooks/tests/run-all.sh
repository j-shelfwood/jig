#!/bin/bash
# Runs every hooks/tests/*.test.sh and prints one line per suite plus the total.
# Run it after changing a hook and before committing ~/.claude. Exit 0 only when every suite passes.
# Last line: `suites: N, failing: N`. RUN_ALL_SUITES overrides the suite directory.
# (The setup this was derived from also stamps the tree on `failing: 0` and has a commit hook refuse a
# commit whose staged hooks differ from the stamped run; add that once this suite is part of your routine.)
DIR="$(cd "$(dirname "$0")" && pwd)"
SUITES="${RUN_ALL_SUITES:-$DIR}"
failed=0; total=0
for t in "$SUITES"/*.test.sh; do
  [ -f "$t" ] || continue
  total=$((total+1))
  out=$(bash "$t" 2>&1); rc=$?
  printf '%-34s rc=%s  %s\n' "$(basename "$t")" "$rc" "$(printf '%s\n' "$out" | tail -1 | cut -c1-90)"
  [ "$rc" -eq 0 ] || { failed=$((failed+1)); printf '%s\n' "$out" | grep FAIL | head -5; }
done
echo "suites: $total, failing: $failed"
[ "$failed" -eq 0 ]
