import json
from typing import Any

import httpx

from llmcost.data.model_resolver import normalize_model_id, resolve_canonical_model_id
from llmcost.types import NormalizedPricingModel

BERRI_URL = (
    "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json"
)

_cache: dict[str, NormalizedPricingModel] | None = None
_provider_cache: dict[str, str] | None = None


def _parse_number(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value)
        except ValueError:
            return None
    return None


def _to_cost_per_1m(entry: dict[str, Any], token_key: str, per_1k_key: str) -> float:
    token_cost = _parse_number(entry.get(token_key))
    if token_cost is not None:
        return token_cost * 1_000_000

    per_1k = _parse_number(entry.get(per_1k_key))
    if per_1k is not None:
        return per_1k * 1_000

    return 0.0


def clear_berri_cache() -> None:
    global _cache, _provider_cache
    _cache = None
    _provider_cache = None


def _extract_provider(entry: dict[str, Any]) -> str | None:
    for key in ("litellm_provider", "provider", "custom_llm_provider"):
        value = entry.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip().lower()
    return None


def _fetch_berri_data() -> tuple[dict[str, NormalizedPricingModel], dict[str, str]]:
    response = httpx.get(BERRI_URL, timeout=30.0)
    response.raise_for_status()
    payload = json.loads(response.text)

    out: dict[str, NormalizedPricingModel] = {}
    provider_out: dict[str, str] = {}
    for model_id, entry in payload.items():
        if not isinstance(entry, dict):
            continue

        provider = _extract_provider(entry)
        if provider is not None:
            normalized_model = normalize_model_id(model_id)
            canonical_model = resolve_canonical_model_id(model_id)
            provider_out[normalized_model] = provider
            provider_out[canonical_model] = provider

        input_cost = _to_cost_per_1m(entry, "input_cost_per_token", "input_cost_per_1k_tokens")
        output_cost = _to_cost_per_1m(
            entry, "output_cost_per_token", "output_cost_per_1k_tokens"
        )
        if input_cost <= 0 and output_cost <= 0:
            continue

        normalized = NormalizedPricingModel(
            model_id=resolve_canonical_model_id(model_id),
            input_cost_per_1m=input_cost,
            output_cost_per_1m=output_cost,
            currency="USD",
        )
        out[normalize_model_id(model_id)] = normalized
        out[normalized.model_id] = normalized

    return out, provider_out


def get_berri_pricing_map() -> dict[str, NormalizedPricingModel]:
    global _cache, _provider_cache
    if _cache is not None:
        return _cache

    _cache, _provider_cache = _fetch_berri_data()
    return _cache


def get_berri_model_provider_map() -> dict[str, str]:
    global _cache, _provider_cache
    if _provider_cache is not None:
        return _provider_cache

    _cache, _provider_cache = _fetch_berri_data()
    return _provider_cache
