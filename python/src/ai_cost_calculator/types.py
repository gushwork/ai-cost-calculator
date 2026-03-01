from dataclasses import dataclass
from typing import Dict, List, TypedDict


class CostResult(TypedDict):
    currency: str
    cost: float


class ResponseMetadata(TypedDict):
    model: str
    provider: str


@dataclass(frozen=True)
class TokenUsage:
    input_tokens: float
    output_tokens: float
    total_tokens: float


@dataclass(frozen=True)
class NormalizedPricingModel:
    model_id: str
    input_cost_per_1m: float
    output_cost_per_1m: float
    currency: str = "USD"


class ResponseProviderMapping(TypedDict):
    inputTokensPaths: List[str]
    outputTokensPaths: List[str]
    totalTokensPaths: List[str]


ResponseMappingsConfig = Dict[str, ResponseProviderMapping]
