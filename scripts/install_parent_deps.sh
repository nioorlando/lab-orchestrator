#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PARENT_DIR="$(cd "${ROOT_DIR}/.." && pwd)"

if [ ! -f "${PARENT_DIR}/package.json" ]; then
  node - "${ROOT_DIR}" "${PARENT_DIR}" <<'NODE'
const fs = require('fs');
const path = require('path');
const root = process.argv[2];
const parent = process.argv[3];
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const out = {
  name: 'lab-orchestrator-parent',
  private: true,
  type: 'module',
  dependencies: pkg.dependencies || {},
  devDependencies: pkg.devDependencies || {}
};
fs.writeFileSync(path.join(parent, 'package.json'), JSON.stringify(out, null, 2));
console.log('Created parent package.json for dependencies.');
NODE
else
  echo "Parent package.json already exists at ${PARENT_DIR}/package.json. Using it as-is."
fi

cd "${PARENT_DIR}"
npm install
