from typing import Any

from ai_cost_calculator.calculator.base import Calculator
from ai_cost_calculator.data.model_resolver import strip_provider_prefix
from ai_cost_calculator.data.response_transformer import extract_response_metadata, extract_token_usage
from ai_cost_calculator.errors import ModelNotFoundError, PricingUnavailableError
from ai_cost_calculator.providers.helicone_client import (
    get_helicone_pricing_map,
    helicone_pattern_lookup,
)
from ai_cost_calculator.types import CostResult


def _round_12(value: float) -> float:
    return round(value, 12)


class HeliconeBasedCalculator(Calculator):
    @staticmethod
    def get_cost(response: Any) -> CostResult:
        metadata = extract_response_metadata(response)
        model = metadata["model"]
        provider = metadata["provider"]
        usage = extract_token_usage(response, provider)
        pricing_map = get_helicone_pricing_map()
        normalized_model = model.strip().lower()
        canonical_model = strip_provider_prefix(normalized_model)
        pricing = (
            pricing_map.get(normalized_model)
            or pricing_map.get(canonical_model)
            or helicone_pattern_lookup(pricing_map, normalized_model)
        )
        if pricing is None:
            raise ModelNotFoundError(f'Model "{model}" not found in Helicone pricing.')
        if pricing.input_cost_per_1m < 0 or pricing.output_cost_per_1m < 0:
            raise PricingUnavailableError(
                f'Model "{model}" has invalid Helicone pricing values.'
            )

        cost = (
            (usage.input_tokens / 1_000_000) * pricing.input_cost_per_1m
            + (usage.output_tokens / 1_000_000) * pricing.output_cost_per_1m
        )
        return {"currency": "USD", "cost": _round_12(cost)}
