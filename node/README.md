# @llmcost/sdk (Node)

TypeScript SDK for calculating LLM response costs with provider-based usage extraction and pricing lookups.

## Install

```bash
npm install
```

## Usage

```ts
import { BestEffortCalculator } from "@llmcost/sdk";

const result = await BestEffortCalculator.getCost(
  {
    model: "gpt-4o-mini",
    usage: {
      prompt_tokens: 1000,
      completion_tokens: 500,
      total_tokens: 1500,
    },
  },
);
```

`provider` is inferred at runtime from BerriAI/LiteLLM model metadata, fetched and cached on first request.

Result shape:

```json
{ "currency": "USD", "cost": 0.45 }
```

## Extending Providers

Add/update mappings in root `configs/`:

- `response-mappings.json`
- `model-aliases.json`
- `provider-pricing-mappings.json`

No core calculator API changes are required for mapping updates.
OpenRouter model IDs (`provider/model`) are normalized to maximize multi-provider coverage.

## Scripts

- `npm run build`
- `npm run typecheck`
- `npm test`
- `npm run test:e2e`

## E2E

`tests/e2e/live.test.ts` loads root `.env` and runs only when `LLMCOST_E2E_LIVE=true`.
When live mode is enabled, it prefers OpenRouter (`OPENROUTER_API_KEY`) and falls back to native OpenAI (`OPENAI_API_KEY`).
OpenAI live endpoint coverage includes:
- Responses API (`/v1/responses`)
- Chat Completions API (`/v1/chat/completions`)
- Legacy Completions API (`/v1/completions`) when `LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL` is configured
