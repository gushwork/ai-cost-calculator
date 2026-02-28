from typing import Any

from llmcost.calculator.base import Calculator
from llmcost.data.model_resolver import resolve_canonical_model_id
from llmcost.data.response_transformer import extract_response_metadata, extract_token_usage
from llmcost.errors import ModelNotFoundError, PricingUnavailableError
from llmcost.providers.openrouter_client import get_openrouter_pricing_map
from llmcost.types import CostResult


def _round_12(value: float) -> float:
    return round(value, 12)


class OpenRouterBasedCalculator(Calculator):
    @staticmethod
    def get_cost(response: Any) -> CostResult:
        metadata = extract_response_metadata(response)
        model = metadata["model"]
        provider = metadata["provider"]
        usage = extract_token_usage(response, provider)
        pricing_map = get_openrouter_pricing_map()
        normalized_model = model.strip().lower()
        pricing = pricing_map.get(normalized_model) or pricing_map.get(
            resolve_canonical_model_id(normalized_model)
        )
        if pricing is None:
            raise ModelNotFoundError(f'Model "{model}" not found in OpenRouter pricing.')
        if pricing.input_cost_per_1m < 0 or pricing.output_cost_per_1m < 0:
            raise PricingUnavailableError(
                f'Model "{model}" has invalid OpenRouter pricing values.'
            )

        cost = (
            (usage.input_tokens / 1_000_000) * pricing.input_cost_per_1m
            + (usage.output_tokens / 1_000_000) * pricing.output_cost_per_1m
        )
        return {"currency": "USD", "cost": _round_12(cost)}
