import json
import os
from pathlib import Path
from typing import Any

from ai_cost_calculator.types import ResponseMappingsConfig


def _resolve_configs_dir() -> Path:
    if os.getenv("LLMCOST_CONFIGS_DIR"):
        return Path(os.environ["LLMCOST_CONFIGS_DIR"])

    candidates = [
        Path.cwd().parent / "configs",
        Path.cwd() / "configs",
        Path(__file__).resolve().parents[4] / "configs",
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    return candidates[0]


def _read_json(file_name: str) -> Any:
    return json.loads((_resolve_configs_dir() / file_name).read_text(encoding="utf-8"))


def load_response_mappings_config() -> ResponseMappingsConfig:
    return _read_json("response-mappings.json")
