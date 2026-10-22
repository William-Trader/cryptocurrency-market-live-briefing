#!/usr/bin/env bash
set -euo pipefail

# Prepare a checkout for first use. Idempotent and non-destructive.

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

echo "== crypto-market-live-briefing setup =="
echo "root: $ROOT"

if ! command -v node >/dev/null 2>&1; then
  echo "ERROR: node is required (>= 18). Install Node.js first." >&2
  exit 1
fi

NODE_MAJOR="$(node -p "process.versions.node.split('.')[0]")"
if [ "$NODE_MAJOR" -lt 18 ]; then
  echo "ERROR: Node $(node -v) is too old; need >= 18." >&2
  exit 1
fi
echo "node: $(node -v)"

mkdir -p reports

if [ ! -f config/platforms.json ]; then
  cp config/platforms.example.json config/platforms.json
  chmod 600 config/platforms.json
  echo "created config/platforms.json (mode 600) from the example"
else
  echo "config/platforms.json already exists; left untouched"
fi

echo ""
echo "== syntax check =="
node scripts/check.js

echo ""
echo "== offline tests =="
node --test test/*.test.js

echo ""
echo "== live doctor =="
node bin/crypto-intel.js doctor || echo "doctor reported issues; inspect the output above"

echo ""
echo "Next:"
echo "  1. edit config/platforms.json (or export env: variables)"
echo "  2. node bin/crypto-intel.js publish --platform <name> --dry-run"
echo "  3. node bin/crypto-intel.js publish --platform <name>"
