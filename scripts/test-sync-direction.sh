#!/usr/bin/env bash
#
# Tests that the two sync scripts refuse to run in the wrong direction.
#
# Both directions are destructive when reversed: sync-latest-to-next.js run on
# the example tutorials reverts whatever the cosmos/example bot last brought in,
# and run on the generated API reference it publishes one version's content
# under another version's stamp. Both have a REFUSED or ALLOWED list, and this
# checks the lists are wired to an actual refusal rather than a warning.
#
# Every operation here is idempotent, so a clean tree stays clean. Run it from
# the repo root with nothing uncommitted in sdk/, or the identity checks will
# compare against your own edits.
#
#   bash scripts/test-sync-direction.sh

set -uo pipefail
cd "$(dirname "$0")/.."

pass=0; fail=0
check() { if [ "$2" = "$3" ]; then echo "  ok    $1"; pass=$((pass+1)); else echo "  FAIL  $1  (got $2, want $3)"; fail=$((fail+1)); fi; }

# 1. Each refused prefix: non-zero exit AND target untouched.
for p in sdk/latest/tutorials/example/05-run-and-test.mdx \
         sdk/latest/api-reference/grpc/bank.mdx \
         sdk/latest/api-reference/rest/openapi.yaml; do
  t=${p/\/latest\//\/next\/}
  before=$([ -f "$t" ] && md5 -q "$t" || echo none)
  node scripts/sync-latest-to-next.js "$p" >/tmp/g.log 2>&1; rc=$?
  after=$([ -f "$t" ] && md5 -q "$t" || echo none)
  check "refuses $(basename $(dirname $p))/$(basename $p)" "$rc" "1"
  check "  target untouched" "$before" "$after"
done

# 2. A .yaml is not collected by the dir walk, so test the grpc dir form too.
node scripts/sync-latest-to-next.js sdk/latest/api-reference/grpc/ >/tmp/g2.log 2>&1
check "refuses the whole grpc dir" "$(grep -c '✗' /tmp/g2.log)" "21"

# 3. sync-next-to-latest refuses a non-exempt page, leaves it alone.
b=$(md5 -q sdk/latest/learn/concepts/encoding.mdx)
node scripts/sync-next-to-latest.js sdk/next/learn/concepts/encoding.mdx >/tmp/g3.log 2>&1; rc=$?
check "reverse refuses non-exempt" "$rc" "1"
check "  target untouched" "$b" "$(md5 -q sdk/latest/learn/concepts/encoding.mdx)"

# 4. Reverse sync is idempotent on the exempt path.
b=$(md5 -q sdk/latest/tutorials/example/04-counter-walkthrough.mdx)
node scripts/sync-next-to-latest.js sdk/next/tutorials/example/ >/dev/null 2>&1
check "reverse is idempotent" "$b" "$(md5 -q sdk/latest/tutorials/example/04-counter-walkthrough.mdx)"

# 5. Link direction is actually inverted, not copied.
check "latest has no /sdk/next/ links" "$(grep -c '/sdk/next/' sdk/latest/tutorials/example/05-run-and-test.mdx)" "0"
check "next has no /sdk/latest/ links" "$(grep -c '(/sdk/latest/' sdk/next/tutorials/example/05-run-and-test.mdx)" "0"

# 6. latest kept its own front matter (no noindex leaking in from next).
check "latest has no noindex" "$(grep -c '^noindex:' sdk/latest/tutorials/example/00-overview.mdx)" "0"
check "next kept noindex" "$(grep -c '^noindex:' sdk/next/tutorials/example/00-overview.mdx)" "1"

echo; echo "$pass passed, $fail failed"
