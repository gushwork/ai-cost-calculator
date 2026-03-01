# ai-cost-calculator (Python)

Python SDK for calculating LLM API costs from provider response payloads with automatic usage extraction and live pricing lookups.

## Installation

```bash
pip install ai-cost-calculator
```

Requires Python ≥ 3.10.

For development:

```bash
uv sync
```

## Usage

### Basic — Best-Effort Cost Calculation

The simplest way to get a cost. Tries multiple pricing sources until one succeeds:

```python
from ai_cost_calculator import BestEffortCalculator

response = {
    "model": "gpt-4o-mini",
    "usage": {
        "prompt_tokens": 1000,
        "completion_tokens": 500,
        "total_tokens": 1500,
    }
}

result = BestEffortCalculator.get_cost(response)
print(result)
# {"currency": "USD", "cost": 0.000225}
```

### Using a Specific Pricing Source

Pick a calculator to use a single pricing backend:

```python
from ai_cost_calculator import (
    OpenRouterBasedCalculator,
    BerrilmBasedCalculator,
    PortkeyBasedCalculator,
    HeliconeBasedCalculator,
)

result = BerrilmBasedCalculator.get_cost(response)
```

### With Provider-Prefixed Models

Models prefixed with a provider (e.g. from OpenRouter) are automatically normalized:

```python
result = BestEffortCalculator.get_cost({
    "model": "openai/gpt-4o-mini",
    "usage": {"prompt_tokens": 1000, "completion_tokens": 500, "total_tokens": 1500},
})
```

### Anthropic Response Format

Each provider's response format is handled automatically:

```python
result = BestEffortCalculator.get_cost({
    "model": "claude-sonnet-4-20250514",
    "usage": {"input_tokens": 2000, "output_tokens": 800},
})
```

### Google Response Format

```python
result = BestEffortCalculator.get_cost({
    "model": "gemini-2.0-flash",
    "usageMetadata": {
        "promptTokenCount": 1500,
        "candidatesTokenCount": 600,
        "totalTokenCount": 2100,
    },
})
```

### Error Handling

```python
from ai_cost_calculator import BestEffortCalculator
from ai_cost_calculator.errors import (
    BestEffortCalculationError,
    ModelNotFoundError,
    UsageNotFoundError,
)

try:
    result = BestEffortCalculator.get_cost(response)
except BestEffortCalculationError as e:
    print("All pricing sources failed:")
    for cause in e.causes:
        print(f"  - {cause}")
except UsageNotFoundError:
    print("Could not extract token usage from response")
```

## API Reference

### Calculators

All calculators expose a single static method:

```python
@staticmethod
def get_cost(response: Any) -> CostResult
```

| Calculator | Pricing Source | Fallback Order |
|------------|---------------|----------------|
| `BestEffortCalculator` | All sources | OpenRouter → Berri → Portkey → Helicone |
| `OpenRouterBasedCalculator` | OpenRouter models API | — |
| `BerrilmBasedCalculator` | BerriAI/LiteLLM JSON | — |
| `PortkeyBasedCalculator` | Portkey pricing API | — |
| `HeliconeBasedCalculator` | Helicone pricing API | — |

### Types

```python
class CostResult(TypedDict):
    currency: str   # "USD"
    cost: float

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
    currency: str  # "USD"

class ResponseMetadata(TypedDict):
    model: str
    provider: str
```

### Errors

All errors extend `LlmcostError`:

| Error | Description |
|-------|-------------|
| `UsageNotFoundError` | Token usage cannot be extracted from the response |
| `ModelNotFoundError` | Model not found in the pricing source |
| `PricingUnavailableError` | Pricing values are invalid |
| `ModelInferenceError` | Model ID cannot be read from the response |
| `ProviderInferenceError` | Provider cannot be determined from the model |
| `BestEffortCalculationError` | All sources failed; `.causes` contains individual errors |

## Extending Provider Support

Add or update mappings in the root `configs/` directory:

- `response-mappings.json` — JSONPath expressions for extracting token usage per provider
- `provider-pricing-mappings.json` — JSONPath expressions for normalizing pricing payloads

No code changes are required for mapping updates.

## Tests

```bash
uv run pytest
```

Live E2E tests run only when `LLMCOST_E2E_LIVE=true` is set in the root `.env`.

When live mode is enabled, tests prefer OpenRouter (`OPENROUTER_API_KEY`) and fall back to native OpenAI (`OPENAI_API_KEY`). OpenAI endpoint coverage includes:

- Responses API (`/v1/responses`)
- Chat Completions API (`/v1/chat/completions`)
- Legacy Completions API (`/v1/completions`) — runs only when `LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL` is configured
