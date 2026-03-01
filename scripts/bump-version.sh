#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

NODE_PKG="$ROOT_DIR/node/package.json"
PYTHON_TOML="$ROOT_DIR/python/pyproject.toml"

usage() {
  echo "Usage: $0 [--major | --minor | --patch]"
  exit 1
}

[[ $# -ne 1 ]] && usage

BUMP="$1"
[[ "$BUMP" != "--major" && "$BUMP" != "--minor" && "$BUMP" != "--patch" ]] && usage

# Read current version from package.json (source of truth)
CURRENT=$(jq -r '.version' "$NODE_PKG")

IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"

case "$BUMP" in
  --major) MAJOR=$((MAJOR + 1)); MINOR=0; PATCH=0 ;;
  --minor) MINOR=$((MINOR + 1)); PATCH=0 ;;
  --patch) PATCH=$((PATCH + 1)) ;;
esac

NEW="$MAJOR.$MINOR.$PATCH"

# Update node/package.json
jq --arg v "$NEW" '.version = $v' "$NODE_PKG" > "$NODE_PKG.tmp" && mv "$NODE_PKG.tmp" "$NODE_PKG"

# Update python/pyproject.toml
PYTHON_CURRENT=$(grep -m1 '^version' "$PYTHON_TOML" | sed 's/version = "\(.*\)"/\1/')
sed -i.bak "s/^version = \"$PYTHON_CURRENT\"/version = \"$NEW\"/" "$PYTHON_TOML" && rm "$PYTHON_TOML.bak"

# Sync lockfiles
(cd "$ROOT_DIR/node" && bun i)
(cd "$ROOT_DIR/python" && uv sync)

echo "$CURRENT → $NEW"
