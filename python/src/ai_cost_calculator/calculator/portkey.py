from ai_cost_calculator.calculator.base import Calculator, PricingSource
from ai_cost_calculator.providers.portkey_client import get_portkey_pricing_map


class PortkeyBasedCalculator(Calculator):
    pricing_source = PricingSource(name="Portkey", get_pricing_map=lambda: get_portkey_pricing_map())
