from typing import Any

from ai_cost_calculator.calculator.base import Calculator
from ai_cost_calculator.calculator.berri import BerrilmBasedCalculator
from ai_cost_calculator.calculator.helicone import HeliconeBasedCalculator
from ai_cost_calculator.calculator.openrouter import OpenRouterBasedCalculator
from ai_cost_calculator.calculator.portkey import PortkeyBasedCalculator
from ai_cost_calculator.errors import BestEffortCalculationError
from ai_cost_calculator.types import CostResult


class BestEffortCalculator(Calculator):
    calculators = [
        OpenRouterBasedCalculator,
        BerrilmBasedCalculator,
        PortkeyBasedCalculator,
        HeliconeBasedCalculator,
    ]

    @staticmethod
    def get_cost(response: Any, *, model: str | None = None, provider: str | None = None) -> CostResult:
        failures: list[Exception] = []
        for calculator in BestEffortCalculator.calculators:
            try:
                return calculator.get_cost(response, model=model, provider=provider)
            except Exception as exc:  # noqa: BLE001
                failures.append(exc)
        raise BestEffortCalculationError(failures)
