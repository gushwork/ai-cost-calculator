import json
import os
from pathlib import Path
from typing import Any

from ai_cost_calculator.types import ResponseMappingsConfig

_BUNDLED_DIR = Path(__file__).resolve().parent
_REPO_CONFIGS_DIR = Path(__file__).resolve().parents[4] / "configs"


def _resolve_configs_dir() -> Path:
    if os.getenv("LLMCOST_CONFIGS_DIR"):
        return Path(os.environ["LLMCOST_CONFIGS_DIR"])
    if (_BUNDLED_DIR / "response-mappings.json").exists():
        return _BUNDLED_DIR
    if _REPO_CONFIGS_DIR.exists():
        return _REPO_CONFIGS_DIR
    return _BUNDLED_DIR


def _read_json(file_name: str) -> Any:
    return json.loads((_resolve_configs_dir() / file_name).read_text(encoding="utf-8"))


_response_mappings_cache: ResponseMappingsConfig | None = None

def load_response_mappings_config() -> ResponseMappingsConfig:
    global _response_mappings_cache
    if _response_mappings_cache is None:
        _response_mappings_cache = _read_json("response-mappings.json")
    return _response_mappings_cache
