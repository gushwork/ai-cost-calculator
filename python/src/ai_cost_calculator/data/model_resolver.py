from ai_cost_calculator.data.alias_builder import get_alias_map


def normalize_model_id(model: str) -> str:
    return model.strip().lower()


def strip_provider_prefix(model_id: str) -> str:
    idx = model_id.find("/")
    return model_id[idx + 1 :] if idx >= 0 else model_id


def resolve_canonical_model_id(model: str) -> str:
    normalized = normalize_model_id(model)
    aliases = get_alias_map()
    if normalized in aliases:
        return aliases[normalized]
    bare = strip_provider_prefix(normalized)
    if bare != normalized and bare in aliases:
        return aliases[bare]
    return normalized
