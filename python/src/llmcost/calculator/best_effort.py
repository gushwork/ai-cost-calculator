from typing import Any

from llmcost.calculator.base import Calculator
from llmcost.calculator.berri import BerrilmBasedCalculator
from llmcost.calculator.openrouter import OpenRouterBasedCalculator
from llmcost.calculator.portkey import PortkeyBasedCalculator
from llmcost.errors import BestEffortCalculationError
from llmcost.types import CostResult


class BestEffortCalculator(Calculator):
    calculators = [
        OpenRouterBasedCalculator,
        BerrilmBasedCalculator,
        PortkeyBasedCalculator,
    ]

    @staticmethod
    def get_cost(response: Any) -> CostResult:
        failures: list[Exception] = []
        for calculator in BestEffortCalculator.calculators:
            try:
                return calculator.get_cost(response)
            except Exception as exc:  # noqa: BLE001
                failures.append(exc)
        raise BestEffortCalculationError(failures)
