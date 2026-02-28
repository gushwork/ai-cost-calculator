from typing import Any

from llmcost.types import CostResult


class Calculator:
    @staticmethod
    def get_cost(response: Any) -> CostResult:
        raise NotImplementedError("get_cost is not implemented")
