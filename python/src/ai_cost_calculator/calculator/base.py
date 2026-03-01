from dataclasses import dataclass
from typing import Any, Callable, Optional

from ai_cost_calculator.calculator.cost_utils import compute_cost, compute_tool_call_cost
from ai_cost_calculator.data.model_resolver import normalize_model_id, strip_provider_prefix
from ai_cost_calculator.data.response_transformer import (
    detect_tool_calls,
    extract_response_metadata,
    extract_token_usage,
    get_input_includes_cache_read,
)
from ai_cost_calculator.errors import ModelNotFoundError, PricingUnavailableError
from ai_cost_calculator.types import CostResult, NormalizedPricingModel


@dataclass(frozen=True)
class PricingSource:
    name: str
    get_pricing_map: Callable[[], dict[str, NormalizedPricingModel]]
    custom_lookup: Optional[Callable[[dict[str, NormalizedPricingModel], str], Optional[NormalizedPricingModel]]] = None


class Calculator:
    pricing_source: PricingSource

    @classmethod
    def get_cost(cls, response: Any, *, model: str | None = None, provider: str | None = None) -> CostResult:
        source = cls.pricing_source
        metadata = extract_response_metadata(response, model=model, provider=provider)
        resolved_model = metadata["model"]
        resolved_provider = metadata["provider"]
        usage = extract_token_usage(response, resolved_provider)
        pricing_map = source.get_pricing_map()
        normalized_model = normalize_model_id(resolved_model)
        bare_model = strip_provider_prefix(normalized_model)
        pricing = (
            pricing_map.get(normalized_model)
            or pricing_map.get(bare_model)
            or (source.custom_lookup(pricing_map, normalized_model) if source.custom_lookup else None)
        )

        if pricing is None:
            raise ModelNotFoundError(f'Model "{resolved_model}" not found in {source.name} pricing.')
        if pricing.input_cost_per_1m < 0 or pricing.output_cost_per_1m < 0:
            raise PricingUnavailableError(
                f'Model "{resolved_model}" has invalid {source.name} pricing values.'
            )

        base_cost = compute_cost(usage, pricing, get_input_includes_cache_read(resolved_provider))
        tool_call_cost = compute_tool_call_cost(detect_tool_calls(response), pricing)
        cost = base_cost + tool_call_cost if tool_call_cost is not None else base_cost
        result: CostResult = {"currency": "USD", "cost": cost}
        if tool_call_cost is not None:
            result["tool_call_cost"] = tool_call_cost
        return result
