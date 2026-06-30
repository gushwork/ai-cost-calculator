# AGENTS.md

## Cursor Cloud specific instructions

This repo is a dual-SDK library (no long-running services): `node/` (TypeScript, tested with Bun) and `python/` (tested with pytest via uv). Standard dev commands live in `README.md` ("Development") and `setup-and-test-sdks.sh`.

### Toolchain
- `bun` and `uv` are preinstalled in the VM snapshot. They are on PATH for interactive/login shells via `~/.bashrc` (`~/.bun/bin`, `~/.local/bin`).
- Non-interactive shells (e.g. the startup update script) may not source `~/.bashrc`; in that case invoke tools by full path (`"$HOME/.local/bin/uv"`, `"$HOME/.bun/bin/bun"`) or prepend those dirs to PATH. `node`/`npm` are on the system PATH.

### Lint / test / build / run
- Node SDK (`cd node`): `npm run typecheck` (this is the only "lint"/type check; runs `prepare-config` to copy `../configs/*.json` into `src/data/` first), `bun test tests/unit` for tests. `npm run build` produces `dist/`.
- Python SDK (`cd python`): `uv run pytest tests/ --ignore=tests/test_e2e_live.py`.
- There is no server/app to run; the "application" is the SDK. A quick smoke run is calling `BestEffortCalculator.getCost`/`get_cost` (see `README.md` Quick Start). Passing `pricing=...` skips all external pricing API calls (fully offline/deterministic); without it, the SDK fetches live pricing over the network.

### Gotchas
- The Node `typecheck`/`build` steps copy `configs/*.json` into `node/src/data/` and `dist/data/`. If you edit token mappings, edit the source of truth in the repo-root `configs/` directory, not the copies.
- `tests/e2e/live.test.ts` and `python/tests/test_e2e_live.py` are live/network E2E tests that are skipped without `LLMCOST_E2E_LIVE=true` and provider API keys (see `README.md` "E2E Environment"); they are intentionally excluded from the default/CI test runs.
