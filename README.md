# ai-cost-calculator

Dual SDK (TypeScript + Python) for calculating LLM API costs from provider response payloads using live pricing data.

Pass any LLM response object and get back the cost — the SDK automatically extracts token usage, resolves the model, and looks up pricing from multiple sources.

## Features

- **Zero-config cost calculation** — pass a raw LLM response, get back the cost.
- **Multi-source pricing** — aggregates pricing from OpenRouter, BerriAI/LiteLLM, Portkey, and Helicone.
- **Broad provider coverage** — OpenAI, Anthropic, Google, Meta, Mistral, Cohere, xAI, DeepSeek, Qwen, Jina, and more.
- **Automatic model resolution** — normalizes model IDs and strips provider prefixes for cross-source consistency.
- **Provider-aware token extraction** — handles each provider's response format via configurable JSONPath mappings.
- **Tool call cost tracking** — detects tool use in responses and reports the additional system prompt cost when available.
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

You can optionally pass `model` and/or `provider` to skip automatic extraction:

```typescript
const result = await BestEffortCalculator.getCost(response, {
  model: "gpt-4o-mini",
  provider: "openai",
});
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

You can optionally pass `model` and/or `provider` to skip automatic extraction:

```python
result = BestEffortCalculator.get_cost(response, model="gpt-4o-mini", provider="openai")
```

## How It Works

1. **Extract model** — reads the `model` field from the response.
2. **Infer provider** — looks up the model in pricing metadata to determine the provider (e.g. `openai`, `anthropic`).
3. **Extract token usage** — uses provider-specific JSONPath mappings to read input/output/total token counts.
4. **Resolve pricing** — fetches and caches live pricing data, matches the model, and computes cost as `(input_tokens / 1M) × input_price + (output_tokens / 1M) × output_price`.
5. **Detect tool calls** — if the response contains tool use, reports the additional system prompt token cost (when available from the pricing source).

## Architecture

### High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        User Code                                │
│         getCost({ model: "gpt-4o", usage: { ... } })            │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│                   BestEffortCalculator                           │
│  Tries each pricing source in order until one succeeds          │
│  OpenRouter → Berri → Portkey → Helicone                        │
└──────────────────────────┬──────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────┐
│           Calculator Base Class (shared flow)                    │
│                                                                  │
│  1. Extract model ID & infer provider                            │
│  2. Extract token usage via JSONPath                             │
│  3. Fetch pricing map from the configured source                 │
│  4. Normalize model ID → look up pricing                         │
│  5. Validate pricing values                                      │
│  6. Compute cost (input + output + cache tokens)                 │
│  7. Detect tool calls → compute tool call cost                   │
│  8. Return { currency, cost, toolCallCost? }                     │
└──────────────────────────┬──────────────────────────────────────┘
                           │
          ┌────────────────┼────────────────┐
          ▼                ▼                ▼
   ┌─────────────┐  ┌───────────┐  ┌──────────────┐
   │  Response    │  │  Model    │  │   Pricing    │
   │ Transformer  │  │ Resolver  │  │   Providers  │
   │              │  │           │  │              │
   │ Extract      │  │ Normalize │  │ Fetch live   │
   │ model ID &   │  │ model IDs │  │ pricing from │
   │ token usage  │  │ & strip   │  │ remote APIs  │
   │ via JSONPath │  │ prefixes  │  │ & cache it   │
   └──────┬──────┘  └─────┬─────┘  └──────┬───────┘
          │                │               │
          ▼                ▼               ▼
┌─────────────────────────────────────────────────────────────────┐
│                       computeCost()                             │
│                                                                 │
│  cost = (input / 1M) × inputRate                                │
│       + (cacheRead / 1M) × cacheReadRate                        │
│       + (cacheCreation / 1M) × cacheCreationRate                │
│       + (output / 1M) × outputRate                              │
└─────────────────────────────────────────────────────────────────┘
```

Each calculator subclass is a thin config wrapper (~5 lines) that specifies its pricing source name, pricing map getter, and optional custom lookup function. All shared logic lives in the base class.

### Repository Structure

```
llmcost-sdk/
├── configs/                          # Shared config (single source of truth)
│   └── response-mappings.json        #   JSONPath mappings for token extraction per provider
├── node/                             # TypeScript SDK
│   └── src/
│       ├── index.ts                  #   Public API exports
│       ├── types.ts                  #   CostResult, TokenUsage, PricingSource interfaces
│       ├── errors.ts                 #   Error hierarchy (extends LlmcostError)
│       ├── utils.ts                  #   Shared numeric parsing utilities
│       ├── calculator/               #   Calculator implementations
│       │   ├── Calculator.ts         #     Base class with shared getCost flow
│       │   ├── computeCost.ts        #     Cost formula
│       │   ├── BestEffortCalculator.ts
│       │   └── <Source>BasedCalculator.ts  # ~5 lines each
│       ├── providers/                #   Remote pricing API clients (fetch + cache)
│       │   └── <source>Client.ts
│       └── data/                     #   Config loading, model resolution, token extraction
│           ├── configLoader.ts       #     Cached config loading
│           ├── responseTransformer.ts
│           └── modelResolver.ts
├── python/                           # Python SDK (mirrors Node structure)
│   └── src/ai_cost_calculator/
│       ├── __init__.py               #   Public API exports
│       ├── types.py
│       ├── errors.py
│       ├── utils.py                  #   Shared numeric parsing utilities
│       ├── calculator/               #   Calculator implementations
│       │   ├── base.py               #     Base class with shared get_cost flow
│       │   ├── cost_utils.py
│       │   ├── best_effort.py
│       │   └── <source>.py           # ~5 lines each
│       ├── providers/                #   Remote pricing API clients (httpx + cache)
│       │   └── <source>_client.py
│       └── data/                     #   Config loading, model resolution, token extraction
│           ├── config_loader.py      #     Cached config loading
│           ├── response_transformer.py
│           └── model_resolver.py
└── .github/workflows/               # CI/CD
    ├── auto-release.yml              #   Detects version bumps, triggers publish
    ├── publish-npm.yml               #   Build, test, publish to npm, smoke test
    └── publish-pypi.yml              #   Build, test, publish to PyPI, smoke test
```

### Data Flow

A cost calculation request goes through the base class flow:

```
Response Object
      │
      ▼
 ┌──────────────────────────────────────────────────┐
 │ 1. Extract Model                                  │
 │    Read the "model" field from the response        │
 └───────────────────────┬──────────────────────────┘
                         ▼
 ┌──────────────────────────────────────────────────┐
 │ 2. Infer Provider                                 │
 │    Look up model in Berri's model→provider map    │
 │    to determine the provider (openai, anthropic…) │
 └───────────────────────┬──────────────────────────┘
                         ▼
 ┌──────────────────────────────────────────────────┐
 │ 3. Extract Tokens                                 │
 │    Load provider-specific JSONPath mappings from   │
 │    response-mappings.json and extract:             │
 │    • input tokens   • output tokens                │
 │    • cache read     • cache creation (if present)  │
 └───────────────────────┬──────────────────────────┘
                         ▼
 ┌──────────────────────────────────────────────────┐
 │ 4. Resolve Pricing & Compute                      │
 │    Fetch live pricing → normalize model ID →       │
 │    match model → apply cost formula                │
 └───────────────────────┬──────────────────────────┘
                         ▼
 ┌──────────────────────────────────────────────────┐
 │ 5. Detect Tool Calls & Compute Tool Cost          │
 │    Check for tool_calls / tool_use / functionCall  │
 │    If present and pricing includes system prompt   │
 │    token count, compute additional tool call cost  │
 └───────────────────────┬──────────────────────────┘
                         ▼
              { currency, cost, toolCallCost? }
```

### Module Responsibilities

| Layer | Node | Python | Role |
|-------|------|--------|------|
| **Calculators** | `calculator/` | `calculator/` | Base class implements shared flow; subclasses declare pricing source config |
| **Providers** | `providers/` | `providers/` | Fetch, cache, and normalize remote pricing data |
| **Data** | `data/` | `data/` | Cached config loading, JSONPath-based token extraction, model normalization |
| **Utils** | `utils.ts` | `utils.py` | Shared numeric parsing utilities |
| **Shared Config** | `configs/` | `configs/` | Provider-agnostic JSONPath mappings bundled into both SDKs at publish time |

### Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **Parameterized base class** | Each calculator is ~5 lines of config (pricing source name + getter + optional custom lookup); all shared logic is in one place |
| **Shared `configs/` directory** | Single source of truth ensures both SDKs extract tokens identically |
| **Best-effort fallback chain** | Multiple pricing sources improve resilience — if one is down or lacks a model, the next source is tried |
| **Provider-aware token extraction** | Each LLM provider uses a different response schema; JSONPath mappings handle this without hardcoded parsing |
| **Provider inference from model ID** | Uses Berri's model→provider map so callers don't need to specify the provider |
| **Model normalization** | Strips prefixes (`openai/gpt-4o` → `gpt-4o`) and lowercases for cross-source consistency |
| **Cache token support** | Separately priced cache read/creation tokens (Anthropic, OpenAI) are computed with their own rates |
| **Tool call cost tracking** | When a response contains tool use and the pricing source provides `tool_use_system_prompt_tokens`, the additional cost is reported separately |
| **Cached config loading** | `response-mappings.json` is read from disk once and cached in memory |
| **Shared `parseNumeric` utility** | One canonical implementation per SDK avoids inconsistent numeric parsing across provider clients |
| **Async Node / sync Python** | Node uses native `fetch`; Python uses blocking `httpx` — each follows its ecosystem's conventions |
| **Independent versioning** | Node and Python packages version and release independently, allowing different cadences |
| **CI bundles configs at publish** | `configs/*.json` are copied into each SDK's dist at build time so published packages are self-contained |

## Packages

| Directory | Description |
|-----------|-------------|
| `node/` | TypeScript SDK (Node.js ≥ 18, Bun for tests) |
| `python/` | Python SDK (≥ 3.10) |
| `configs/` | Shared JSONPath mappings |

## Calculators

Each calculator uses a different pricing source. `BestEffortCalculator` tries them all in order.

| Calculator | Pricing Source | Node | Python |
|------------|---------------|------|--------|
| `BestEffortCalculator` | All sources (fallback chain) | Yes | Yes |
| `OpenRouterBasedCalculator` | [OpenRouter](https://openrouter.ai/api/v1/models) | Yes | Yes |
| `BerrilmBasedCalculator` | [BerriAI/LiteLLM](https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json) | Yes | Yes |
| `PortkeyBasedCalculator` | [Portkey](https://configs.portkey.ai/pricing) | Yes | Yes |
| `HeliconeBasedCalculator` | [Helicone](https://www.helicone.ai/api/llm-costs) | Yes | Yes |

`BestEffortCalculator` fallback order: OpenRouter → Berri → Portkey → Helicone.

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

Config resolution order: `LLMCOST_CONFIGS_DIR` env var → bundled package data → repo-root `configs/`.

Configs are automatically bundled into the published packages during CI. The shared source of truth is the `configs/` directory at the repo root.

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
| Calculators | All async (`await getCost(response, options?)`) | Synchronous (`get_cost(response, *, model?, provider?)`) |
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
