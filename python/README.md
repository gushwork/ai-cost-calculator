# ai-cost-calculator (Python)

Python SDK for calculating LLM response costs with provider-based usage extraction and pricing lookups.

## Install

```bash
uv sync
```

## Usage

```python
from ai_cost_calculator import BestEffortCalculator

result = BestEffortCalculator.get_cost(
    {
        "model": "gpt-4o-mini",
        "usage": {
            "prompt_tokens": 1000,
            "completion_tokens": 500,
            "total_tokens": 1500,
        }
    }
)
```

`provider` is inferred at runtime from BerriAI/LiteLLM model metadata, fetched and cached on first request.

Result shape:

```python
{"currency": "USD", "cost": 0.45}
```

## Extending Providers

Add/update mappings in root `configs/`:

- `response-mappings.json`
- `model-aliases.json`
- `provider-pricing-mappings.json`

OpenRouter model IDs (`provider/model`) are normalized to maximize multi-provider coverage.

## Tests

```bash
uv run pytest
```

Live e2e tests read root `.env` and run only with `LLMCOST_E2E_LIVE=true`.
When enabled, tests prefer OpenRouter (`OPENROUTER_API_KEY`) and fall back to native OpenAI (`OPENAI_API_KEY`).
OpenAI live endpoint coverage includes:
- Responses API (`/v1/responses`)
- Chat Completions API (`/v1/chat/completions`)
- Legacy Completions API (`/v1/completions`) when `LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL` is configured
