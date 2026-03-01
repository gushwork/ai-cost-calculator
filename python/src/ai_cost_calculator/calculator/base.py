from typing import Any

from ai_cost_calculator.types import CostResult


class Calculator:
    @staticmethod
    def get_cost(response: Any, *, model: str | None = None, provider: str | None = None) -> CostResult:
        raise NotImplementedError("get_cost is not implemented")
