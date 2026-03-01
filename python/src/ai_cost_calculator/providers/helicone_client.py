import json
from typing import Any

import httpx

from ai_cost_calculator.data.model_resolver import normalize_model_id, strip_provider_prefix
from ai_cost_calculator.types import NormalizedPricingModel
from ai_cost_calculator.utils import parse_number_clean

HELICONE_URL = "https://www.helicone.ai/api/llm-costs"

_cache: dict[str, NormalizedPricingModel] | None = None
_pattern_entries: list[dict[str, Any]] | None = None


def _model_matches(candidate: str, pattern: str, operator: str) -> bool:
    if operator == "equals":
        return candidate == pattern
    if operator == "startsWith":
        return candidate.startswith(pattern)
    if operator == "includes":
        return pattern in candidate
    return candidate == pattern


def clear_helicone_cache() -> None:
    global _cache, _pattern_entries
    _cache = None
    _pattern_entries = None


def helicone_pattern_lookup(
    pricing_map: dict[str, NormalizedPricingModel],
    model_id: str,
) -> NormalizedPricingModel | None:
    global _pattern_entries
    if _pattern_entries is None:
        return None

    normalized = normalize_model_id(model_id)
    for entry in _pattern_entries:
        model = entry.get("model")
        operator = entry.get("operator")
        if not model or not operator:
            continue
        if _model_matches(normalized, normalize_model_id(model), operator):
            input_cost = parse_number_clean(entry.get("input_cost_per_1m")) or 0.0
            output_cost = parse_number_clean(entry.get("output_cost_per_1m")) or 0.0
            if input_cost <= 0 and output_cost <= 0:
                continue
            return NormalizedPricingModel(
                model_id=normalized,
                input_cost_per_1m=input_cost,
                output_cost_per_1m=output_cost,
                currency="USD",
            )
    return None


def get_helicone_pricing_map() -> dict[str, NormalizedPricingModel]:
    global _cache, _pattern_entries
    if _cache is not None:
        return _cache

    response = httpx.get(HELICONE_URL, timeout=30.0)
    response.raise_for_status()
    payload = json.loads(response.text)

    exact_entries: list[dict[str, Any]] = []
    patterns: list[dict[str, Any]] = []

    for entry in payload.get("data", []):
        if not isinstance(entry, dict) or not entry.get("model"):
            continue
        op = entry.get("operator", "equals")
        if op == "equals":
            exact_entries.append(entry)
        else:
            patterns.append(entry)

    out: dict[str, NormalizedPricingModel] = {}
    for entry in exact_entries:
        model_raw = entry["model"]
        input_cost = parse_number_clean(entry.get("input_cost_per_1m")) or 0.0
        output_cost = parse_number_clean(entry.get("output_cost_per_1m")) or 0.0
        if input_cost <= 0 and output_cost <= 0:
            continue

        norm_id = normalize_model_id(model_raw)
        bare_id = strip_provider_prefix(norm_id)
        pricing = NormalizedPricingModel(
            model_id=bare_id,
            input_cost_per_1m=input_cost,
            output_cost_per_1m=output_cost,
            currency="USD",
        )
        out[norm_id] = pricing
        if bare_id != norm_id:
            out[bare_id] = pricing

    _pattern_entries = patterns
    _cache = out
    return out
