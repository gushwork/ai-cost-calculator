import json
import os
from typing import Any

import httpx

from ai_cost_calculator.data.model_resolver import normalize_model_id, strip_provider_prefix
from ai_cost_calculator.types import NormalizedPricingModel

OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models"
_cache: dict[str, NormalizedPricingModel] | None = None


def _parse_number(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        cleaned = value.replace("$", "").replace(",", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return None
    return None


def _parse_per_token_to_per_1m(value: Any) -> float | None:
    per_token = _parse_number(value)
    if per_token is None:
        return None
    return per_token * 1_000_000


def clear_openrouter_cache() -> None:
    global _cache
    _cache = None


def get_openrouter_pricing_map() -> dict[str, NormalizedPricingModel]:
    global _cache
    if _cache is not None:
        return _cache

    headers: dict[str, str] = {}
    if os.getenv("OPENROUTER_API_KEY"):
        headers["Authorization"] = f'Bearer {os.getenv("OPENROUTER_API_KEY")}'
    if os.getenv("OPENROUTER_HTTP_REFERER"):
        headers["HTTP-Referer"] = os.getenv("OPENROUTER_HTTP_REFERER", "")
    if os.getenv("OPENROUTER_X_TITLE"):
        headers["X-Title"] = os.getenv("OPENROUTER_X_TITLE", "")

    response = httpx.get(OPENROUTER_MODELS_URL, headers=headers, timeout=30.0)
    response.raise_for_status()
    payload = json.loads(response.text)

    out: dict[str, NormalizedPricingModel] = {}
    for raw_model in payload.get("data", []):
        if not isinstance(raw_model, dict):
            continue

        model_id = raw_model.get("id")
        canonical_slug = raw_model.get("canonical_slug")
        model_raw = model_id if isinstance(model_id, str) else canonical_slug
        if not isinstance(model_raw, str):
            continue

        pricing = raw_model.get("pricing")
        if not isinstance(pricing, dict):
            pricing = {}

        input_cost = _parse_per_token_to_per_1m(pricing.get("prompt")) or 0.0
        output_cost = _parse_per_token_to_per_1m(pricing.get("completion"))
        if output_cost is None:
            output_cost = input_cost
        if input_cost <= 0 and output_cost <= 0:
            continue

        cache_read_cost = _parse_per_token_to_per_1m(pricing.get("input_cache_read"))
        cache_creation_cost = _parse_per_token_to_per_1m(pricing.get("input_cache_write"))

        bare_id = strip_provider_prefix(normalize_model_id(model_raw))
        normalized = NormalizedPricingModel(
            model_id=bare_id,
            input_cost_per_1m=input_cost,
            output_cost_per_1m=output_cost,
            currency="USD",
            cache_read_cost_per_1m=cache_read_cost,
            cache_creation_cost_per_1m=cache_creation_cost,
        )
        keys = {
            normalize_model_id(model_raw),
            bare_id,
        }
        if isinstance(model_id, str):
            keys.add(normalize_model_id(model_id))
            id_bare = strip_provider_prefix(normalize_model_id(model_id))
            if id_bare != normalize_model_id(model_id):
                keys.add(id_bare)
        if isinstance(canonical_slug, str):
            keys.add(normalize_model_id(canonical_slug))
        if (
            isinstance(model_id, str)
            and isinstance(canonical_slug, str)
            and "/" not in canonical_slug
            and "/" in model_id
        ):
            provider_prefix = model_id.split("/", maxsplit=1)[0]
            keys.add(normalize_model_id(f"{provider_prefix}/{canonical_slug}"))

        for key in keys:
            out[key] = normalized

    _cache = out
    return out
