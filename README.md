# ai-cost-calculator

Dual SDK (TypeScript + Python) for calculating LLM API costs from provider response payloads using live pricing data.

Pass any LLM response object and get back the cost — the SDK automatically extracts token usage, resolves the model, and looks up pricing from multiple sources.

## Features

- **Zero-config cost calculation** — pass a raw LLM response, get back the cost.
- **Multi-source pricing** — aggregates pricing from OpenRouter, BerriAI/LiteLLM, Portkey, Helicone, and Jina.
- **Broad provider coverage** — OpenAI, Anthropic, Google, Meta, Mistral, Cohere, xAI, DeepSeek, Qwen, Jina, and more.
- **Automatic model resolution** — normalizes model IDs, strips provider prefixes, and resolves aliases.
- **Provider-aware token extraction** — handles each provider's response format via configurable JSONPath mappings.
- **Best-effort fallback** — tries multiple pricing sources until one succeeds.
- **Shared config** — both SDKs use the same mapping files for consistent behavior.

## Quick Start

### Node.js / TypeScript

```bash
npm install ai-cost-calculator
```

```typescript
import { BestEffortCalculator } from "ai-cost-calculator";

const result = await BestEffortCalculator.getCost({
  model: "gpt-4o-mini",
  usage: {
    prompt_tokens: 1000,
    completion_tokens: 500,
    total_tokens: 1500,
  },
});

console.log(result);
// { currency: "USD", cost: 0.000225 }
```

### Python

```bash
pip install ai-cost-calculator
```

```python
from ai_cost_calculator import BestEffortCalculator

result = BestEffortCalculator.get_cost({
    "model": "gpt-4o-mini",
    "usage": {
        "prompt_tokens": 1000,
        "completion_tokens": 500,
        "total_tokens": 1500,
    }
})

print(result)
# {"currency": "USD", "cost": 0.000225}
```

## How It Works

1. **Extract model** — reads the `model` field from the response.
2. **Infer provider** — looks up the model in pricing metadata to determine the provider (e.g. `openai`, `anthropic`).
3. **Extract token usage** — uses provider-specific JSONPath mappings to read input/output/total token counts.
4. **Resolve pricing** — fetches and caches live pricing data, matches the model, and computes cost as `(input_tokens / 1M) × input_price + (output_tokens / 1M) × output_price`.

## Packages

| Directory | Description |
|-----------|-------------|
| `node/` | TypeScript SDK (Node.js ≥ 18, Bun for tests) |
| `python/` | Python SDK (≥ 3.10) |
| `configs/` | Shared JSONPath mappings and config schema |

## Calculators

Each calculator uses a different pricing source. `BestEffortCalculator` tries them all in order.

| Calculator | Pricing Source | Node | Python |
|------------|---------------|------|--------|
| `BestEffortCalculator` | All sources (fallback chain) | Yes | Yes |
| `OpenRouterBasedCalculator` | [OpenRouter](https://openrouter.ai/api/v1/models) | Yes | Yes |
| `BerrilmBasedCalculator` | [BerriAI/LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) | Yes | Yes |
| `PortkeyBasedCalculator` | [Portkey](https://configs.portkey.ai/pricing) | Yes | Yes |
| `HeliconeBasedCalculator` | [Helicone](https://www.helicone.ai/api/llm-costs) | Yes | Yes |
| `JinaBasedCalculator` | Jina models | Yes | No |

`BestEffortCalculator` fallback order: OpenRouter → Berri → Portkey → Jina (Node only) → Helicone.

## Supported Providers

Token extraction supports provider-specific response formats out of the box:

| Provider | Response format |
|----------|----------------|
| OpenAI (Chat Completions) | `usage.prompt_tokens` / `usage.completion_tokens` |
| OpenAI (Responses API) | `usage.input_tokens` / `usage.output_tokens` |
| OpenRouter | `usage.prompt_tokens` / `usage.completion_tokens` |
| Anthropic | `usage.input_tokens` / `usage.output_tokens` |
| Google | `usageMetadata.promptTokenCount` / `usageMetadata.candidatesTokenCount` |
| Cohere | `meta.billed_units.input_tokens` / `meta.billed_units.output_tokens` |
| Meta, Mistral, xAI, DeepSeek, Qwen | `usage.prompt_tokens` / `usage.completion_tokens` |
| Jina | `usage.prompt_tokens` / `usage.total_tokens` |

Unknown providers fall back to a `default` mapping that covers the most common response shapes.

## Shared Config Files

Both SDKs read from the `configs/` directory:

| File | Purpose |
|------|---------|
| `response-mappings.json` | JSONPath expressions for extracting token usage per provider |
| `provider-pricing-mappings.json` | JSONPath expressions for normalizing pricing payloads |

Config resolution order: `LLMCOST_CONFIGS_DIR` env var → `../configs` → `./configs` → relative to module.

## Error Handling

All errors extend `LlmcostError`:

| Error | When |
|-------|------|
| `UsageNotFoundError` | Token usage cannot be extracted from the response |
| `ModelNotFoundError` | Model not found in the pricing source |
| `PricingUnavailableError` | Pricing data has invalid values |
| `ModelInferenceError` | Model ID cannot be read from the response |
| `ProviderInferenceError` | Provider cannot be determined from model ID |
| `BestEffortCalculationError` | All pricing sources failed (`.causes` has individual errors) |

## SDK Differences

| Aspect | Node.js | Python |
|--------|---------|--------|
| Calculators | All async (`await getCost(...)`) | Synchronous (`get_cost(...)`) |
| Jina calculator | Yes | No |
| HTTP client | `fetch` | `httpx` |
| JSONPath engine | `jsonpath-plus` | `jsonpath-ng` |

## Development

### Node

```bash
cd node
npm install
npm run typecheck
npm test
npm run test:e2e
```

### Python

```bash
cd python
uv sync
uv run pytest
```

### E2E Environment

Create `.env` in the repo root for optional live tests:

```env
LLMCOST_E2E_LIVE=true
LLMCOST_E2E_MODEL=gpt-4o-mini
OPENROUTER_API_KEY=...
LLMCOST_E2E_OPENROUTER_MODEL=openai/gpt-4o-mini
OPENAI_API_KEY=...
LLMCOST_E2E_OPENAI_RESPONSES_MODEL=gpt-4o-mini
LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL=gpt-3.5-turbo-instruct
```

E2E tests prefer OpenRouter when `OPENROUTER_API_KEY` is set and fall back to native OpenAI. OpenAI endpoint coverage includes `/v1/responses`, `/v1/chat/completions`, and `/v1/completions` (legacy, opt-in).

## License

MIT
