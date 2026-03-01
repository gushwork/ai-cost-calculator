def normalize_model_id(model: str) -> str:
    return model.strip().lower()


def strip_provider_prefix(model_id: str) -> str:
    idx = model_id.find("/")
    return model_id[idx + 1 :] if idx >= 0 else model_id
