# ai-cost-calculator (Node.js)

TypeScript SDK for calculating LLM API costs from provider response payloads with automatic usage extraction and live pricing lookups.

## Installation

```bash
npm install ai-cost-calculator
```

Requires Node.js ≥ 18.

## Usage

### Basic — Best-Effort Cost Calculation

The simplest way to get a cost. Tries multiple pricing sources until one succeeds:

```typescript
import { BestEffortCalculator } from "ai-cost-calculator";

const response = {
  model: "gpt-4o-mini",
  usage: {
    prompt_tokens: 1000,
    completion_tokens: 500,
    total_tokens: 1500,
  },
};

const result = await BestEffortCalculator.getCost(response);
console.log(result);
// { currency: "USD", cost: 0.000225 }
```

### Using a Specific Pricing Source

Pick a calculator to use a single pricing backend:

```typescript
import {
  OpenRouterBasedCalculator,
  BerrilmBasedCalculator,
  PortkeyBasedCalculator,
  JinaBasedCalculator,
  HeliconeBasedCalculator,
} from "ai-cost-calculator";

const result = await BerrilmBasedCalculator.getCost(response);
```

### Custom Pricing

Override external pricing with your own rates (e.g. bulk or negotiated pricing):

```typescript
const result = await BestEffortCalculator.getCost(response, {
  pricing: { inputCostPer1M: 0.0455, outputCostPer1M: 0 },
});
```

When `pricing` is provided, no external pricing APIs are called. Both `inputCostPer1M` and `outputCostPer1M` are required. Cache token rates (`cacheReadCostPer1M`, `cacheCreationCostPer1M`) are optional. Works with any calculator, not just `BestEffortCalculator`.

### With Provider-Prefixed Models

Models prefixed with a provider (e.g. from OpenRouter) are automatically normalized:

```typescript
const result = await BestEffortCalculator.getCost({
  model: "openai/gpt-4o-mini",
  usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
});
```

### Anthropic Response Format

Each provider's response format is handled automatically:

```typescript
const result = await BestEffortCalculator.getCost({
  model: "claude-sonnet-4-20250514",
  usage: { input_tokens: 2000, output_tokens: 800 },
});
```

### Google Response Format

```typescript
const result = await BestEffortCalculator.getCost({
  model: "gemini-2.0-flash",
  usageMetadata: {
    promptTokenCount: 1500,
    candidatesTokenCount: 600,
    totalTokenCount: 2100,
  },
});
```

### Extracting Token Usage

Extract token counts from a response without computing cost:

```typescript
import { extractTokenUsage } from "ai-cost-calculator";

const usage = extractTokenUsage(
  { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
  "openai"
);
// { inputTokens: 10, outputTokens: 5, totalTokens: 15 }
```

### Extracting Response Metadata

Read the model and infer the provider:

```typescript
import { extractResponseModel, extractResponseMetadata } from "ai-cost-calculator";

const model = extractResponseModel(response);
// "gpt-4o-mini"

const metadata = await extractResponseMetadata(response);
// { model: "gpt-4o-mini", provider: "openai" }
```

### Provider Inference

Determine the provider from a model ID:

```typescript
import { inferProviderFromModel } from "ai-cost-calculator";

const provider = await inferProviderFromModel("gpt-4o-mini");
// "openai"
```

### Model Resolution

Normalize and resolve model IDs:

```typescript
import {
  normalizeModelId,
  stripProviderPrefix,
  resolveCanonicalModelId,
} from "ai-cost-calculator";

normalizeModelId("GPT-4o-Mini");
// "gpt-4o-mini"

stripProviderPrefix("openai/gpt-4o-mini");
// "gpt-4o-mini"

const canonical = await resolveCanonicalModelId("openai/gpt-4o-mini");
// "gpt-4o-mini"
```

### Accessing Pricing Maps Directly

Fetch the raw pricing data from each source:

```typescript
import {
  getBerriPricingMap,
  getOpenRouterPricingMap,
  getPortkeyPricingMap,
  getJinaPricingMap,
  getHeliconePricingMap,
} from "ai-cost-calculator";

const berriPricing = await getBerriPricingMap();
// Map<string, NormalizedPricingModel>

const pricing = berriPricing.get("gpt-4o-mini");
// { modelId: "gpt-4o-mini", inputCostPer1M: 0.15, outputCostPer1M: 0.6, currency: "USD" }
```

### Cache Management

Pricing data is cached on first request. Clear caches to force a refresh:

```typescript
import {
  clearBerriCache,
  clearOpenRouterCache,
  clearPortkeyCache,
  clearJinaCache,
  clearHeliconeCache,
  clearAliasCache,
} from "ai-cost-calculator";

clearBerriCache();
clearOpenRouterCache();
```

### Error Handling

```typescript
import {
  BestEffortCalculator,
  BestEffortCalculationError,
  ModelNotFoundError,
  UsageNotFoundError,
} from "ai-cost-calculator";

try {
  const result = await BestEffortCalculator.getCost(response);
} catch (error) {
  if (error instanceof BestEffortCalculationError) {
    console.error("All pricing sources failed:");
    for (const cause of error.causes) {
      console.error(`  - ${cause.message}`);
    }
  }
}
```

## API Reference

### Calculators

All calculators expose a single static async method:

```typescript
static async getCost(response: unknown): Promise<CostResult>
```

| Calculator | Pricing Source | Fallback Order |
|------------|---------------|----------------|
| `BestEffortCalculator` | All sources | OpenRouter → Berri → Portkey → Jina → Helicone |
| `OpenRouterBasedCalculator` | OpenRouter models API | — |
| `BerrilmBasedCalculator` | BerriAI/LiteLLM JSON | — |
| `PortkeyBasedCalculator` | Portkey pricing API | — |
| `JinaBasedCalculator` | Jina models | — |
| `HeliconeBasedCalculator` | Helicone pricing API | — |

### Types

```typescript
interface CostResult {
  currency: "USD";
  cost: number;
}

interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

interface NormalizedPricingModel {
  modelId: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  currency: "USD";
}

interface ResponseMetadata {
  model: string;
  provider: string;
}
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

## Scripts

| Command | Description |
|---------|-------------|
| `npm run build` | Compile TypeScript to `dist/` |
| `npm run typecheck` | Type-check without emitting |
| `npm test` | Run unit tests (Bun) |
| `npm run test:e2e` | Run end-to-end tests |

## E2E Tests

`tests/e2e/live.test.ts` runs only when `LLMCOST_E2E_LIVE=true` is set in the root `.env`.

When live mode is enabled, tests prefer OpenRouter (`OPENROUTER_API_KEY`) and fall back to native OpenAI (`OPENAI_API_KEY`). OpenAI endpoint coverage includes:

- Responses API (`/v1/responses`)
- Chat Completions API (`/v1/chat/completions`)
- Legacy Completions API (`/v1/completions`) — runs only when `LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL` is configured
