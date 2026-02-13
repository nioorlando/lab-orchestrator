#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARENT_DIR="$(cd "${ROOT_DIR}/.." && pwd)"

if [ ! -d "${PARENT_DIR}/node_modules" ]; then
  mkdir -p "${PARENT_DIR}/node_modules"
fi

if [ ! -e "${ROOT_DIR}/frontend/node_modules" ]; then
  ln -sfn "${PARENT_DIR}/node_modules" "${ROOT_DIR}/frontend/node_modules"
fi

cd "${ROOT_DIR}/frontend"
npm run dev
