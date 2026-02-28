#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
NODE_DIR="${ROOT_DIR}/node"
PYTHON_DIR="${ROOT_DIR}/python"

MODE="${1:-offline}"
OFFLINE_MODEL="${LLMCOST_OFFLINE_MODEL:-offline/mock-model}"

if [[ "${MODE}" != "offline" && "${MODE}" != "live" ]]; then
  echo "Usage: $0 [offline|live]"
  exit 1
fi

if [[ ! -d "${NODE_DIR}" || ! -d "${PYTHON_DIR}" ]]; then
  echo "Expected 'node/' and 'python/' directories under: ${ROOT_DIR}"
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Missing required tool: npm"
  exit 1
fi

if ! command -v uv >/dev/null 2>&1; then
  echo "Missing required tool: uv"
  exit 1
fi

echo "==> Mode: ${MODE}"

if [[ "${MODE}" == "offline" ]]; then
  # Force non-live e2e behavior and set a deterministic placeholder model.
  export LLMCOST_E2E_LIVE=false
  export LLMCOST_E2E_MODEL="${OFFLINE_MODEL}"
  unset OPENROUTER_API_KEY || true
  unset OPENAI_API_KEY || true
fi

echo "==> Node SDK setup"
npm --prefix "${NODE_DIR}" install

echo "==> Node SDK tests"
npm --prefix "${NODE_DIR}" run typecheck
npm --prefix "${NODE_DIR}" test
npm --prefix "${NODE_DIR}" run test:e2e

echo "==> Python SDK setup"
uv --directory "${PYTHON_DIR}" sync --group dev

echo "==> Python SDK tests"
uv --directory "${PYTHON_DIR}" run pytest

echo "==> Completed successfully"
