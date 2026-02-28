import { normalizeModelId, resolveCanonicalModelId } from "../data/modelResolver.js";
import type { NormalizedPricingModel } from "../types.js";

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
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

function parsePerTokenToPer1M(value: unknown): number | null {
  const perToken = parseNumeric(value);
  if (perToken === null) return null;
  return perToken * 1_000_000;
}

type OpenRouterModelPayload = {
  id?: unknown;
  canonical_slug?: unknown;
  pricing?: {
    prompt?: unknown;
    completion?: unknown;
  };
};

async function fetchOpenRouterPricing(): Promise<Map<string, NormalizedPricingModel>> {
  const headers: Record<string, string> = {};
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`;
  }
  if (process.env.OPENROUTER_HTTP_REFERER) {
    headers["HTTP-Referer"] = process.env.OPENROUTER_HTTP_REFERER;
  }
  if (process.env.OPENROUTER_X_TITLE) {
    headers["X-Title"] = process.env.OPENROUTER_X_TITLE;
  }

  const response = await fetch(OPENROUTER_MODELS_URL, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch OpenRouter models: ${response.status}`);
  }

  const payload = (await response.json()) as { data?: OpenRouterModelPayload[] };
  const models = Array.isArray(payload.data) ? payload.data : [];

  const out = new Map<string, NormalizedPricingModel>();
  for (const model of models) {
    const idRaw = typeof model.id === "string" ? model.id : null;
    const canonicalSlugRaw =
      typeof model.canonical_slug === "string" ? model.canonical_slug : null;
    const modelRaw = idRaw ?? canonicalSlugRaw;
    if (!modelRaw) continue;

    const inputCostPer1M = parsePerTokenToPer1M(model.pricing?.prompt) ?? 0;
    const outputCostPer1M = parsePerTokenToPer1M(model.pricing?.completion) ?? inputCostPer1M;
    if (inputCostPer1M <= 0 && outputCostPer1M <= 0) continue;

    const canonicalId = resolveCanonicalModelId(modelRaw);
    const normalized: NormalizedPricingModel = {
      modelId: canonicalId,
      inputCostPer1M,
      outputCostPer1M,
      currency: "USD",
    };

    const keys = new Set<string>([
      normalizeModelId(modelRaw),
      normalizeModelId(canonicalId),
    ]);
    if (idRaw) keys.add(normalizeModelId(idRaw));
    if (canonicalSlugRaw) keys.add(normalizeModelId(canonicalSlugRaw));

    // OpenRouter can return canonical_slug without provider prefix.
    // Preserve both provider/model and model-only lookups when possible.
    if (idRaw && canonicalSlugRaw && !canonicalSlugRaw.includes("/") && idRaw.includes("/")) {
      const providerPrefix = idRaw.split("/")[0];
      keys.add(normalizeModelId(`${providerPrefix}/${canonicalSlugRaw}`));
    }

    for (const key of keys) {
      out.set(key, normalized);
    }
  }

  return out;
}

export async function getOpenRouterPricingMap(): Promise<Map<string, NormalizedPricingModel>> {
  if (!cachePromise) {
    cachePromise = fetchOpenRouterPricing();
  }
  return cachePromise;
}

export function clearOpenRouterCache(): void {
  cachePromise = null;
}
