#!/usr/bin/env bash
# Assembles the deployed site: static landing page at /, experiments under
# their own paths.
set -euo pipefail
cd "$(dirname "$0")/.."

npm --prefix experiments/01-ground-aerial-link ci
npm --prefix experiments/01-ground-aerial-link run build

rm -rf _site
mkdir -p _site
cp -r site/. _site/
cp -r experiments/01-ground-aerial-link/dist _site/01-ground-aerial-link
