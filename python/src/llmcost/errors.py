class LlmcostError(Exception):
    pass


class UsageNotFoundError(LlmcostError):
    pass


class ModelNotFoundError(LlmcostError):
    pass


class PricingUnavailableError(LlmcostError):
    pass


class ModelInferenceError(LlmcostError):
    pass


class ProviderInferenceError(LlmcostError):
    pass


class BestEffortCalculationError(LlmcostError):
    def __init__(self, causes: list[Exception]):
        self.causes = causes
        message = "; ".join(str(cause) for cause in causes)
        super().__init__(f"All calculators failed: {message}")
