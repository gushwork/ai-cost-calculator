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
from ai_cost_calculator.types import CostResult, CustomPricing, NormalizedPricingModel


@dataclass(frozen=True)
class PricingSource:
    name: str
    get_pricing_map: Callable[[], dict[str, NormalizedPricingModel]]
    custom_lookup: Optional[Callable[[dict[str, NormalizedPricingModel], str], Optional[NormalizedPricingModel]]] = None


class Calculator:
    pricing_source: PricingSource

    @classmethod
    def get_cost(
        cls,
        response: Any,
        *,
        model: str | None = None,
        provider: str | None = None,
        pricing: CustomPricing | None = None,
    ) -> CostResult:
        metadata = extract_response_metadata(response, model=model, provider=provider)
        resolved_model = metadata["model"]
        resolved_provider = metadata["provider"]
        usage = extract_token_usage(response, resolved_provider)

        if pricing is not None:
            resolved_pricing = NormalizedPricingModel(
                model_id=resolved_model,
                input_cost_per_1m=pricing["input_cost_per_1m"],
                output_cost_per_1m=pricing["output_cost_per_1m"],
                cache_read_cost_per_1m=pricing.get("cache_read_cost_per_1m"),
                cache_creation_cost_per_1m=pricing.get("cache_creation_cost_per_1m"),
            )
        else:
            source = cls.pricing_source
            pricing_map = source.get_pricing_map()
            normalized_model = normalize_model_id(resolved_model)
            bare_model = strip_provider_prefix(normalized_model)
            found = (
                pricing_map.get(normalized_model)
                or pricing_map.get(bare_model)
                or (source.custom_lookup(pricing_map, normalized_model) if source.custom_lookup else None)
            )

            if found is None:
                raise ModelNotFoundError(f'Model "{resolved_model}" not found in {source.name} pricing.')
            if found.input_cost_per_1m < 0 or found.output_cost_per_1m < 0:
                raise PricingUnavailableError(
                    f'Model "{resolved_model}" has invalid {source.name} pricing values.'
                )
            resolved_pricing = found

        base_cost = compute_cost(usage, resolved_pricing, get_input_includes_cache_read(resolved_provider))
        tool_call_cost = compute_tool_call_cost(detect_tool_calls(response), resolved_pricing)
        cost = base_cost + tool_call_cost if tool_call_cost is not None else base_cost
        result: CostResult = {"currency": "USD", "cost": cost}
        if tool_call_cost is not None:
            result["tool_call_cost"] = tool_call_cost
        return result
