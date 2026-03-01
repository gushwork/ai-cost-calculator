from dataclasses import dataclass, field
from typing import Dict, List, Optional, TypedDict


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
    cache_read_tokens: float = 0
    cache_creation_tokens: float = 0


@dataclass(frozen=True)
class NormalizedPricingModel:
    model_id: str
    input_cost_per_1m: float
    output_cost_per_1m: float
    currency: str = "USD"
    cache_read_cost_per_1m: Optional[float] = None
    cache_creation_cost_per_1m: Optional[float] = None


class ResponseProviderMapping(TypedDict, total=False):
    inputTokensPaths: List[str]
    outputTokensPaths: List[str]
    totalTokensPaths: List[str]
    cacheReadTokensPaths: List[str]
    cacheCreationTokensPaths: List[str]
    inputIncludesCacheRead: bool


ResponseMappingsConfig = Dict[str, ResponseProviderMapping]
