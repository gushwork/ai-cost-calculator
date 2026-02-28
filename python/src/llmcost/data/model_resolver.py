from llmcost.data.config_loader import load_model_aliases_config


def normalize_model_id(model: str) -> str:
    return model.strip().lower()


def resolve_canonical_model_id(model: str) -> str:
    normalized = normalize_model_id(model)
    aliases = load_model_aliases_config()["normalized"]
    return aliases.get(normalized, normalized)
