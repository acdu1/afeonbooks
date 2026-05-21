#!/usr/bin/env bash
set -euo pipefail

# Usage: ./scripts/export_source.sh <target-dir>
# Copies repository source into target directory, excluding large/build files.

target="$1"
root_dir="$(pwd)"

mkdir -p "$target"

rsync -a --delete \
  --exclude='node_modules' \
  --exclude='.git' \
  --exclude='dist' \
  --exclude='**/dist' \
  --exclude='public' \
  --exclude='**/public' \
  --exclude='artifacts/*/dist/public/source' \
  --exclude='artifacts/*/dist/public/assets' \
  --exclude='**/node_modules' \
  --exclude='*.log' \
  --exclude='pnpm-lock.yaml' \
  --exclude='**/.cache' \
  --exclude='artifacts/*/dist' \
  --exclude='**/dist/public/source' \
  --exclude='scripts/export_source.sh' \
  ./ "$target/"

echo "Exported source to $target"
