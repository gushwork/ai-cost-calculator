import { normalizeModelId, stripProviderPrefix } from "../data/modelResolver.js";
import type { NormalizedPricingModel } from "../types.js";

const PORTKEY_JINA_PRICING_BASE_URL = "https://api.portkey.ai/model-configs/pricing/jina";

export const JINA_MODELS = [
  "jina-reranker-v3",
  "jina-embeddings-v2-base-en",
  "jina-reranker-v2-base-multilingual",
  "jina-reranker-v1-base-en",
  "jina-colbert-v2",
] as const;

type JinaPricingPayload = {
  pay_as_you_go?: {
    request_token?: { price?: unknown };
    response_token?: { price?: unknown };
  };
  currency?: unknown;
};

let cachePromise: Promise<Map<string, NormalizedPricingModel>> | null = null;

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const cleaned = value.replace(/[$,\s]/g, "");
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function perTokenToPer1M(value: unknown): number | null {
  const perToken = parseNumeric(value);
  if (perToken === null) return null;
  return perToken * 1_000_000;
}

function addPricingModel(
  map: Map<string, NormalizedPricingModel>,
  modelId: string,
  inputCostPer1M: number,
  outputCostPer1M: number,
) {
  const normalized = normalizeModelId(modelId);
  const bare = stripProviderPrefix(normalized);
  const pricing: NormalizedPricingModel = {
    modelId: bare,
    inputCostPer1M,
    outputCostPer1M,
    currency: "USD",
  };

  map.set(normalized, pricing);
  if (bare !== normalized) map.set(bare, pricing);
}

async function fetchModelPricing(model: string): Promise<NormalizedPricingModel | null> {
  const response = await fetch(`${PORTKEY_JINA_PRICING_BASE_URL}/${encodeURIComponent(model)}`);
  if (!response.ok) {
    if (response.status === 404) return null;
    throw new Error(`Failed to fetch Jina pricing for "${model}": ${response.status}`);
  }

  const payload = (await response.json()) as JinaPricingPayload;
  const inputCostPer1M = perTokenToPer1M(payload.pay_as_you_go?.request_token?.price) ?? 0;
  const outputCostPer1M = perTokenToPer1M(payload.pay_as_you_go?.response_token?.price) ?? 0;
  if (inputCostPer1M <= 0 && outputCostPer1M <= 0) {
    return null;
  }

  return {
    modelId: stripProviderPrefix(normalizeModelId(model)),
    inputCostPer1M,
    outputCostPer1M,
    currency: "USD",
  };
}

async function fetchJinaPricing(): Promise<Map<string, NormalizedPricingModel>> {
  const out = new Map<string, NormalizedPricingModel>();
  const results = await Promise.all(JINA_MODELS.map((model) => fetchModelPricing(model)));

  for (let i = 0; i < JINA_MODELS.length; i += 1) {
    const pricing = results[i];
    if (!pricing) continue;
    addPricingModel(out, JINA_MODELS[i], pricing.inputCostPer1M, pricing.outputCostPer1M);
  }

  return out;
}

export async function getJinaPricingMap(): Promise<Map<string, NormalizedPricingModel>> {
  if (!cachePromise) {
    cachePromise = fetchJinaPricing();
  }
  return cachePromise;
}

export function clearJinaCache(): void {
  cachePromise = null;
}
