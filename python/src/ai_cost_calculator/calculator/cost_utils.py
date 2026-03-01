from typing import Optional

from ai_cost_calculator.types import NormalizedPricingModel, TokenUsage


def _round_12(value: float) -> float:
    return round(value, 12)


def compute_cost(
    usage: TokenUsage,
    pricing: NormalizedPricingModel,
    input_includes_cache_read: bool,
) -> float:
    input_tokens = max(0, usage.input_tokens)
    output_tokens = max(0, usage.output_tokens)
    cache_read = max(0, usage.cache_read_tokens)
    cache_creation = max(0, usage.cache_creation_tokens)

    effective_input = (
        max(0, input_tokens - cache_read)
        if input_includes_cache_read
        else input_tokens
    )

    cache_read_rate = (
        pricing.cache_read_cost_per_1m
        if pricing.cache_read_cost_per_1m is not None
        else pricing.input_cost_per_1m
    )
    cache_creation_rate = (
        pricing.cache_creation_cost_per_1m
        if pricing.cache_creation_cost_per_1m is not None
        else pricing.input_cost_per_1m
    )

    return _round_12(
        (effective_input / 1_000_000) * pricing.input_cost_per_1m
        + (cache_read / 1_000_000) * cache_read_rate
        + (cache_creation / 1_000_000) * cache_creation_rate
        + (output_tokens / 1_000_000) * pricing.output_cost_per_1m
    )


def compute_tool_call_cost(
    has_tool_calls: bool,
    pricing: NormalizedPricingModel,
) -> Optional[float]:
    if not has_tool_calls or not pricing.tool_use_system_prompt_tokens:
        return None
    return _round_12(
        (pricing.tool_use_system_prompt_tokens / 1_000_000) * pricing.input_cost_per_1m
    )
