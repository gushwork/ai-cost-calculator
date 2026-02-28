import os
from pathlib import Path

from llmcost.data.config_loader import load_model_aliases_config
from llmcost.data.model_resolver import normalize_model_id, resolve_canonical_model_id

os.environ["LLMCOST_CONFIGS_DIR"] = str(Path(__file__).resolve().parents[2] / "configs")


def test_normalize_model_id():
    assert normalize_model_id("  OPENAI/GPT-4O-MINI  ") == "openai/gpt-4o-mini"
    assert normalize_model_id("\nGEMINI-1.5-PRO\t") == "gemini-1.5-pro"


def test_resolve_all_configured_aliases():
    aliases = load_model_aliases_config()["normalized"]
    for alias, canonical in aliases.items():
        assert resolve_canonical_model_id(alias) == canonical


def test_unknown_model_passthrough():
    assert resolve_canonical_model_id("  custom-provider/model-x  ") == "custom-provider/model-x"
