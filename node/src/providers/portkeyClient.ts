import { normalizeModelId, stripProviderPrefix } from "../data/modelResolver.js";
import type { NormalizedPricingModel } from "../types.js";

const PORTKEY_PRICING_PAGE = "https://portkey.ai/docs/integrations/llms";
const PORTKEY_PRICING_BASE = "https://configs.portkey.ai/pricing";

const PORTKEY_PROVIDERS = [
  "openai",
  "anthropic",
  "google",
  "mistral",
  "meta",
  "cohere",
  "deepseek",
  "jina",
  "azure",
] as const;

let cachePromise: Promise<Map<string, NormalizedPricingModel>> | null = null;

function parseNumeric(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const clean = value.replace(/[$,]/g, "");
    const parsed = Number(clean);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function perTokenToPer1M(value: unknown): number | null {
  const perToken = parseNumeric(value);
  if (perToken === null) return null;
  return perToken * 1_000_000;
}

function addToMap(
  out: Map<string, NormalizedPricingModel>,
  id: string,
  pricing: NormalizedPricingModel,
): void {
  const normalized = normalizeModelId(id);
  out.set(normalized, pricing);
  const bare = stripProviderPrefix(normalized);
  if (bare !== normalized) out.set(bare, pricing);
}

type PortkeyPricingEntry = {
  pricing_config?: {
    pay_as_you_go?: {
      request_token?: { price?: unknown };
      response_token?: { price?: unknown };
    };
  };
};

type NextDataModel = {
  id?: unknown;
  name?: unknown;
  model?: unknown;
  slug?: unknown;
  pricing?: {
    inputCostPer1M?: unknown;
    outputCostPer1M?: unknown;
    input?: unknown;
    output?: unknown;
  };
};

function parseNextDataModels(
  text: string,
): Map<string, NormalizedPricingModel> | null {
  const match = text.match(
    /<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  );
  if (!match) return null;

  let nextData: { props?: { pageProps?: { models?: NextDataModel[] } } };
  try {
    nextData = JSON.parse(match[1]);
  } catch {
    return null;
  }

  const models = nextData?.props?.pageProps?.models;
  if (!Array.isArray(models) || models.length === 0) return null;

  const out = new Map<string, NormalizedPricingModel>();

  for (const model of models) {
    const id =
      typeof model.id === "string"
        ? model.id
        : typeof model.name === "string"
          ? model.name
          : typeof model.slug === "string"
            ? model.slug
            : null;
    if (!id || !model.pricing) continue;

    const inputCostPer1M =
      parseNumeric(model.pricing.inputCostPer1M) ??
      parseNumeric(model.pricing.input) ??
      0;
    const outputCostPer1M =
      parseNumeric(model.pricing.outputCostPer1M) ??
      parseNumeric(model.pricing.output) ??
      0;
    if (inputCostPer1M <= 0 && outputCostPer1M <= 0) continue;

    const pricing: NormalizedPricingModel = {
      modelId: normalizeModelId(id),
      inputCostPer1M,
      outputCostPer1M,
      currency: "USD",
    };

    addToMap(out, id, pricing);
  }

  return out.size > 0 ? out : null;
}

async function tryFetchSinglePage(): Promise<Map<
  string,
  NormalizedPricingModel
> | null> {
  try {
    const response = await fetch(PORTKEY_PRICING_PAGE);
    if (!response.ok) return null;

    const text = await response.text();
    return parseNextDataModels(text);
  } catch {
    return null;
  }
}

async function fetchProviderPricing(
  provider: string,
): Promise<Map<string, NormalizedPricingModel>> {
  const out = new Map<string, NormalizedPricingModel>();
  const url = `${PORTKEY_PRICING_BASE}/${provider}.json`;
  const response = await fetch(url);
  if (!response.ok) return out;

  const text = await response.text();

  const htmlResult = parseNextDataModels(text);
  if (htmlResult) return htmlResult;

  let payload: Record<string, PortkeyPricingEntry>;
  try {
    payload = JSON.parse(text) as Record<string, PortkeyPricingEntry>;
  } catch {
    return out;
  }

  for (const [modelKey, entry] of Object.entries(payload)) {
    if (modelKey === "default" || !entry?.pricing_config?.pay_as_you_go)
      continue;

    const payg = entry.pricing_config.pay_as_you_go;
    const inputCostPer1M = perTokenToPer1M(payg.request_token?.price) ?? 0;
    const outputCostPer1M = perTokenToPer1M(payg.response_token?.price) ?? 0;
    if (inputCostPer1M <= 0 && outputCostPer1M <= 0) continue;

    const pricing: NormalizedPricingModel = {
      modelId: normalizeModelId(modelKey),
      inputCostPer1M,
      outputCostPer1M,
      currency: "USD",
    };

    addToMap(out, modelKey, pricing);
  }

  return out;
}

async function fetchPortkeyPricing(): Promise<
  Map<string, NormalizedPricingModel>
> {
  const singlePage = await tryFetchSinglePage();
  if (singlePage && singlePage.size > 0) return singlePage;

  const out = new Map<string, NormalizedPricingModel>();
  const results = await Promise.allSettled(
    PORTKEY_PROVIDERS.map((p) => fetchProviderPricing(p)),
  );

  for (const result of results) {
    if (result.status === "fulfilled") {
      for (const [key, value] of result.value) {
        if (!out.has(key)) out.set(key, value);
      }
    }
  }

  return out;
}

export async function getPortkeyPricingMap(): Promise<
  Map<string, NormalizedPricingModel>
> {
  if (!cachePromise) {
    cachePromise = fetchPortkeyPricing();
  }
  return cachePromise;
}

export function clearPortkeyCache(): void {
  cachePromise = null;
}
