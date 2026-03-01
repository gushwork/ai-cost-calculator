from ai_cost_calculator.types import NormalizedPricingModel, TokenUsage


def _round_12(value: float) -> float:
    return round(value, 12)


def compute_cost(
    usage: TokenUsage,
    pricing: NormalizedPricingModel,
    input_includes_cache_read: bool,
) -> float:
    cache_read = usage.cache_read_tokens
    cache_creation = usage.cache_creation_tokens

    effective_input = (
        max(0, usage.input_tokens - cache_read)
        if input_includes_cache_read
        else usage.input_tokens
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
        + (usage.output_tokens / 1_000_000) * pricing.output_cost_per_1m
    )
