#!/usr/bin/env bash
# Runs the C# tests and the JS tests, then writes parity-report.md.
set -u
here="$(cd "$(dirname "$0")" && pwd)"
root="$(cd "$here/../.." && pwd)"
export DOTNET_ROOT="${DOTNET_ROOT:-$HOME/.dotnet}"
export PATH="$PATH:$DOTNET_ROOT"
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

echo "== C# tests =="
(cd "$root/legacy-logic" && dotnet test --logger "trx;LogFileName=results.trx" --results-directory "$work") \
  | tee "$work/dotnet.txt" | tail -5

echo "== JS tests =="
node --test "$root/conversion/js/rules.test.js" | tee "$work/node.txt" | grep -E "^. (tests|pass|fail)"

node "$here/build-report.js" "$work/results.trx" "$work/dotnet.txt" "$work/node.txt" "$here/parity-report.md"
