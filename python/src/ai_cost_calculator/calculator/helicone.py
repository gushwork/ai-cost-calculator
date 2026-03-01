from typing import Any

from ai_cost_calculator.calculator.base import Calculator
from ai_cost_calculator.calculator.cost_utils import compute_cost
from ai_cost_calculator.data.model_resolver import strip_provider_prefix
from ai_cost_calculator.data.response_transformer import (
    extract_response_metadata,
    extract_token_usage,
    get_input_includes_cache_read,
)
from ai_cost_calculator.errors import ModelNotFoundError, PricingUnavailableError
from ai_cost_calculator.providers.helicone_client import (
    get_helicone_pricing_map,
    helicone_pattern_lookup,
)
from ai_cost_calculator.types import CostResult


class HeliconeBasedCalculator(Calculator):
    @staticmethod
    def get_cost(response: Any, *, model: str | None = None, provider: str | None = None) -> CostResult:
        metadata = extract_response_metadata(response, model=model, provider=provider)
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

        cost = compute_cost(usage, pricing, get_input_includes_cache_read(provider))
        return {"currency": "USD", "cost": cost}
