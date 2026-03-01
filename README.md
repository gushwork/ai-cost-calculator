# ai-cost-calculator SDKs

Dual SDK implementation for calculating LLM API costs from provider response usage and live pricing sources.

## Packages

- `node/`: TypeScript SDK (`bun`)
- `python/`: Python SDK (`uv`, `pytest`)
- `configs/`: Shared config contract and mappings used by both SDKs

## Data Sources

- OpenRouter models API:
  - `https://openrouter.ai/api/v1/models`
- BerriAI LiteLLM pricing JSON:
  - `https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json`
- Portkey model pricing page:
  - `https://portkey.ai/models`

## Provider Coverage

- Broad provider coverage is sourced from OpenRouter model IDs (`provider/model`) and pricing metadata.
- Shared aliases include common providers such as OpenAI, Anthropic, Google, Meta, Mistral, Cohere, xAI, DeepSeek, and Qwen.

## Shared Config Files

- `configs/response-mappings.json`: usage JSONPath extraction per response provider.
- `configs/model-aliases.json`: canonical model alias normalization.
- `configs/provider-pricing-mappings.json`: provider payload pricing path mappings.
- `configs/config-schema.json`: schema describing expected config structures.

## E2E Environment

Create `.env` in repo root for optional live tests:

```env
LLMCOST_E2E_LIVE=true
LLMCOST_E2E_MODEL=gpt-4o-mini
OPENROUTER_API_KEY=...
# Optional OpenRouter live-call defaults:
LLMCOST_E2E_OPENROUTER_MODEL=openai/gpt-4o-mini
OPENAI_API_KEY=...
LLMCOST_E2E_OPENAI_RESPONSES_MODEL=gpt-4o-mini
# Optional; required only for legacy /v1/completions e2e:
LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL=gpt-3.5-turbo-instruct
```

E2E routing:
- Uses OpenRouter when `OPENROUTER_API_KEY` is available.
- Falls back to native OpenAI API when OpenRouter is not configured.
- OpenAI endpoint coverage includes:
  - `/v1/responses`
  - `/v1/chat/completions`
  - `/v1/completions` (legacy; runs only when `LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL` is set)

## Verification

- Node:
  - `cd node && npm run typecheck && npm test && npm run test:e2e`
- Python:
  - `cd python && uv run pytest`
