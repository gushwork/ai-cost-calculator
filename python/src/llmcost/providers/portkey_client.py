import json
import re
from typing import Any

import httpx

from llmcost.data.model_resolver import normalize_model_id, resolve_canonical_model_id
from llmcost.types import NormalizedPricingModel

PORTKEY_URL = "https://portkey.ai/models"
_cache: dict[str, NormalizedPricingModel] | None = None


def _parse_number(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        clean = value.replace("$", "").replace(",", "")
        try:
            return float(clean)
        except ValueError:
            return None
    return None


def _collect_objects_with_pricing(node: Any, out: list[dict[str, Any]]) -> None:
    if isinstance(node, list):
        for item in node:
            _collect_objects_with_pricing(item, out)
        return
    if not isinstance(node, dict):
        return

    has_model = any(isinstance(node.get(key), str) for key in ("id", "model", "name"))
    has_pricing = any(
        key in node
        for key in ("pricing", "input", "output", "inputCostPer1M", "outputCostPer1M")
    )
    if has_model and has_pricing:
        out.append(node)

    for value in node.values():
        _collect_objects_with_pricing(value, out)


def parse_portkey_models_from_html(html: str) -> dict[str, NormalizedPricingModel]:
    chunks: list[dict[str, Any]] = []
    regex = re.compile(
        r'<script[^>]*id="__NEXT_DATA__"[^>]*type="application/json"[^>]*>(.*?)</script>',
        re.DOTALL | re.IGNORECASE,
    )
    for match in regex.finditer(html):
        raw = match.group(1)
        try:
            data = json.loads(raw)
        except json.JSONDecodeError:
            continue
        _collect_objects_with_pricing(data, chunks)

    out: dict[str, NormalizedPricingModel] = {}
    for item in chunks:
        model_raw = item.get("id") or item.get("model") or item.get("name")
        if not isinstance(model_raw, str):
            continue

        pricing = item.get("pricing") if isinstance(item.get("pricing"), dict) else {}
        input_cost = _parse_number(
            pricing.get("inputCostPer1M")
            or pricing.get("input")
            or item.get("inputCostPer1M")
            or item.get("input")
        )
        output_cost = _parse_number(
            pricing.get("outputCostPer1M")
            or pricing.get("output")
            or item.get("outputCostPer1M")
            or item.get("output")
        )

        if input_cost is None and output_cost is None:
            continue
        if input_cost is None:
            input_cost = output_cost
        if output_cost is None:
            output_cost = input_cost
        if input_cost is None or output_cost is None:
            continue

        model = NormalizedPricingModel(
            model_id=resolve_canonical_model_id(model_raw),
            input_cost_per_1m=input_cost,
            output_cost_per_1m=output_cost,
            currency="USD",
        )
        out[normalize_model_id(model_raw)] = model
        out[model.model_id] = model

    return out


def clear_portkey_cache() -> None:
    global _cache
    _cache = None


def get_portkey_pricing_map() -> dict[str, NormalizedPricingModel]:
    global _cache
    if _cache is not None:
        return _cache

    response = httpx.get(PORTKEY_URL, timeout=30.0)
    response.raise_for_status()
    _cache = parse_portkey_models_from_html(response.text)
    return _cache
