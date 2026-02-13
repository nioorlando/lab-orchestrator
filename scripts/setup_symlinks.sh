#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARENT_DIR="$(cd "${ROOT_DIR}/.." && pwd)"

if [ ! -d "${PARENT_DIR}/node_modules" ]; then
  echo "Parent node_modules not found at ${PARENT_DIR}/node_modules"
  echo "Run scripts/install_parent_deps.sh first."
  exit 1
fi

ln -sfn "${PARENT_DIR}/node_modules" "${ROOT_DIR}/backend/node_modules"
ln -sfn "${PARENT_DIR}/node_modules" "${ROOT_DIR}/frontend/node_modules"

echo "Symlinks created:"
ls -l "${ROOT_DIR}/backend/node_modules"
ls -l "${ROOT_DIR}/frontend/node_modules"
