from ai_cost_calculator.calculator.base import Calculator, PricingSource
from ai_cost_calculator.providers.helicone_client import get_helicone_pricing_map, helicone_pattern_lookup


class HeliconeBasedCalculator(Calculator):
    pricing_source = PricingSource(
        name="Helicone",
        get_pricing_map=lambda: get_helicone_pricing_map(),
        custom_lookup=helicone_pattern_lookup,
    )
