#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
unset npm_config_prefix

# Ensure we run with arm64 Node via nvm when available.
if [ -s "$NVM_DIR/nvm.sh" ]; then
  # shellcheck disable=SC1090
  source "$NVM_DIR/nvm.sh"
fi

if command -v nvm >/dev/null 2>&1; then
  nvm use --lts >/dev/null
fi

# Force arm64 execution even if the terminal is running under Rosetta.
# Always prefer arm64 when available (even if this shell is under Rosetta).
if /usr/bin/arch -arm64 /bin/true >/dev/null 2>&1; then
  exec /usr/bin/arch -arm64 bash -lc "cd \"$PROJECT_ROOT\"; source \"$NVM_DIR/nvm.sh\" >/dev/null 2>&1 || true; nvm use --lts >/dev/null 2>&1 || true; export CSS_TRANSFORMER_WASM=1; \"$PROJECT_ROOT/node_modules/.bin/next\" dev"
fi

cd "$PROJECT_ROOT"
export CSS_TRANSFORMER_WASM=1
"$PROJECT_ROOT/node_modules/.bin/next" dev
