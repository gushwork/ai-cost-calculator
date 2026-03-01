from ai_cost_calculator.calculator.base import Calculator, PricingSource
from ai_cost_calculator.providers.berri_client import get_berri_pricing_map


class BerrilmBasedCalculator(Calculator):
    pricing_source = PricingSource(name="Berri", get_pricing_map=lambda: get_berri_pricing_map())
