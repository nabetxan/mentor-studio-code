#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
REPO_ROOT=$(CDPATH= cd -- "$SCRIPT_DIR/../../.." && pwd)

if [ -n "${NVM_BIN:-}" ]; then
  PATH="$NVM_BIN:$PATH"
  export PATH
fi

exec node "$REPO_ROOT/node_modules/vitest/vitest.mjs" "$@"
