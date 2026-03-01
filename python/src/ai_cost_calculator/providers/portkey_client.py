import json
import re
from typing import Any

import httpx

from ai_cost_calculator.data.model_resolver import normalize_model_id, strip_provider_prefix
from ai_cost_calculator.types import NormalizedPricingModel
from ai_cost_calculator.utils import parse_number_clean

PORTKEY_PRICING_PAGE = "https://portkey.ai/docs/integrations/llms"
PORTKEY_PRICING_BASE = "https://configs.portkey.ai/pricing"

PORTKEY_PROVIDERS = [
    "openai",
    "anthropic",
    "google",
    "mistral",
    "meta",
    "cohere",
    "deepseek",
    "jina",
    "azure",
]

_cache: dict[str, NormalizedPricingModel] | None = None


def _per_token_to_per_1m(value: Any) -> float | None:
    per_token = parse_number_clean(value)
    if per_token is None:
        return None
    return per_token * 1_000_000


def _add_to_map(
    out: dict[str, NormalizedPricingModel],
    model_id: str,
    pricing: NormalizedPricingModel,
) -> None:
    normalized = normalize_model_id(model_id)
    out[normalized] = pricing
    bare = strip_provider_prefix(normalized)
    if bare != normalized:
        out[bare] = pricing


def _parse_next_data_models(
    text: str,
) -> dict[str, NormalizedPricingModel] | None:
    match = re.search(
        r'<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>', text
    )
    if not match:
        return None

    try:
        next_data = json.loads(match.group(1))
    except (json.JSONDecodeError, ValueError):
        return None

    models = (
        next_data.get("props", {}).get("pageProps", {}).get("models")
    )
    if not isinstance(models, list) or not models:
        return None

    out: dict[str, NormalizedPricingModel] = {}
    for model in models:
        if not isinstance(model, dict):
            continue
        model_id = model.get("id") or model.get("name") or model.get("slug")
        if not isinstance(model_id, str):
            continue
        pricing = model.get("pricing")
        if not isinstance(pricing, dict):
            continue

        input_cost = (
            parse_number_clean(pricing.get("inputCostPer1M"))
            or parse_number_clean(pricing.get("input"))
            or 0.0
        )
        output_cost = (
            parse_number_clean(pricing.get("outputCostPer1M"))
            or parse_number_clean(pricing.get("output"))
            or 0.0
        )
        if input_cost <= 0 and output_cost <= 0:
            continue

        entry = NormalizedPricingModel(
            model_id=normalize_model_id(model_id),
            input_cost_per_1m=input_cost,
            output_cost_per_1m=output_cost,
            currency="USD",
        )
        _add_to_map(out, model_id, entry)

    return out if out else None


def _try_fetch_single_page() -> dict[str, NormalizedPricingModel] | None:
    try:
        response = httpx.get(PORTKEY_PRICING_PAGE, timeout=15.0)
        if not response.is_success:
            return None
        return _parse_next_data_models(response.text)
    except Exception:
        return None


def _fetch_provider_pricing(provider: str) -> dict[str, NormalizedPricingModel]:
    out: dict[str, NormalizedPricingModel] = {}
    url = f"{PORTKEY_PRICING_BASE}/{provider}.json"
    try:
        response = httpx.get(url, timeout=15.0)
        if not response.is_success:
            return out
        text = response.text
    except Exception:
        return out

    html_result = _parse_next_data_models(text)
    if html_result:
        return html_result

    try:
        payload = json.loads(text)
    except (json.JSONDecodeError, ValueError):
        return out

    for model_key, entry in payload.items():
        if model_key == "default" or not isinstance(entry, dict):
            continue
        pricing_config = entry.get("pricing_config")
        if not isinstance(pricing_config, dict):
            continue
        payg = pricing_config.get("pay_as_you_go")
        if not isinstance(payg, dict):
            continue

        req_token = payg.get("request_token", {})
        resp_token = payg.get("response_token", {})
        input_cost = _per_token_to_per_1m(
            req_token.get("price") if isinstance(req_token, dict) else None
        ) or 0.0
        output_cost = _per_token_to_per_1m(
            resp_token.get("price") if isinstance(resp_token, dict) else None
        ) or 0.0

        if input_cost <= 0 and output_cost <= 0:
            continue

        pricing = NormalizedPricingModel(
            model_id=normalize_model_id(model_key),
            input_cost_per_1m=input_cost,
            output_cost_per_1m=output_cost,
            currency="USD",
        )
        _add_to_map(out, model_key, pricing)

    return out


def clear_portkey_cache() -> None:
    global _cache
    _cache = None


def get_portkey_pricing_map() -> dict[str, NormalizedPricingModel]:
    global _cache
    if _cache is not None:
        return _cache

    single_page = _try_fetch_single_page()
    if single_page:
        _cache = single_page
        return _cache

    out: dict[str, NormalizedPricingModel] = {}
    for provider in PORTKEY_PROVIDERS:
        provider_models = _fetch_provider_pricing(provider)
        for key, value in provider_models.items():
            if key not in out:
                out[key] = value

    _cache = out
    return out
