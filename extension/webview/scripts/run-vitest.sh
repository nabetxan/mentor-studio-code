#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)
PACKAGE_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/.." && pwd)

if [ -n "${NVM_BIN:-}" ]; then
  PATH="$NVM_BIN:$PATH"
  export PATH
fi

if [ -f "$PACKAGE_ROOT/node_modules/vitest/vitest.mjs" ]; then
  exec node "$PACKAGE_ROOT/node_modules/vitest/vitest.mjs" "$@"
fi

exec node "$REPO_ROOT/node_modules/vitest/vitest.mjs" "$@"
