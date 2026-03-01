from ai_cost_calculator.calculator.base import Calculator, PricingSource
from ai_cost_calculator.providers.openrouter_client import get_openrouter_pricing_map


class OpenRouterBasedCalculator(Calculator):
    pricing_source = PricingSource(name="OpenRouter", get_pricing_map=lambda: get_openrouter_pricing_map())
