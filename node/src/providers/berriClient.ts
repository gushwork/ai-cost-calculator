import { normalizeModelId, stripProviderPrefix } from "../data/modelResolver.js";
import type { NormalizedPricingModel } from "../types.js";
import { parseNumeric } from "../utils.js";

const BERRI_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
type BerriData = {
  pricingMap: Map<string, NormalizedPricingModel>;
  providerMap: Map<string, string>;
};

let dataPromise: Promise<BerriData> | null = null;

function toCostPer1M(entry: Record<string, unknown>, tokenKey: string, per1kKey: string) {
  const tokenCost = parseNumeric(entry[tokenKey]);
  if (tokenCost !== null) return tokenCost * 1_000_000;
  const per1kCost = parseNumeric(entry[per1kKey]);
  if (per1kCost !== null) return per1kCost * 1_000;
  return 0;
}

function perTokenToPer1M(entry: Record<string, unknown>, tokenKey: string): number | undefined {
  const tokenCost = parseNumeric(entry[tokenKey]);
  if (tokenCost !== null && tokenCost > 0) return tokenCost * 1_000_000;
  return undefined;
}

function addModel(
  map: Map<string, NormalizedPricingModel>,
  modelId: string,
  data: NormalizedPricingModel,
) {
  const normalized = normalizeModelId(modelId);
  map.set(normalized, data);
  const bare = stripProviderPrefix(normalized);
  if (bare !== normalized) {
    map.set(bare, data);
  }
}

function addProvider(
  map: Map<string, string>,
  modelId: string,
  provider: string,
) {
  const normalized = normalizeModelId(modelId);
  map.set(normalized, provider);
  const bare = stripProviderPrefix(normalized);
  if (bare !== normalized) {
    map.set(bare, provider);
  }
}

function extractProvider(entry: Record<string, unknown>): string | null {
  const candidates = ["litellm_provider", "provider", "custom_llm_provider"];
  for (const key of candidates) {
    const value = entry[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim().toLowerCase();
    }
  }
  return null;
}

async function fetchBerriData(): Promise<BerriData> {
  const response = await fetch(BERRI_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Berri pricing: ${response.status}`);
  }

  const payload = (await response.json()) as Record<string, Record<string, unknown>>;

  const pricingMap = new Map<string, NormalizedPricingModel>();
  const providerMap = new Map<string, string>();

  const entries = Object.entries(payload);
  for (const [key, value] of entries) {
    if (key === "sample_spec") continue;
    const provider = extractProvider(value);
    if (provider) {
      addProvider(providerMap, key, provider);
    }

    const inputCostPer1M = toCostPer1M(value, "input_cost_per_token", "input_cost_per_1k_tokens");
    const outputCostPer1M = toCostPer1M(
      value,
      "output_cost_per_token",
      "output_cost_per_1k_tokens",
    );

    if (inputCostPer1M === 0 && outputCostPer1M === 0) {
      continue;
    }

    const cacheReadCostPer1M = perTokenToPer1M(value, "cache_read_input_token_cost");
    const cacheCreationCostPer1M = perTokenToPer1M(value, "cache_creation_input_token_cost");
    const toolUseTokens = parseNumeric(value["tool_use_system_prompt_tokens"]);
    const toolUseSystemPromptTokens = toolUseTokens !== null && toolUseTokens > 0 ? toolUseTokens : undefined;

    const bareKey = stripProviderPrefix(normalizeModelId(key));
    const normalized: NormalizedPricingModel = {
      modelId: bareKey,
      inputCostPer1M,
      outputCostPer1M,
      cacheReadCostPer1M,
      cacheCreationCostPer1M,
      toolUseSystemPromptTokens,
      currency: "USD",
    };

    addModel(pricingMap, key, normalized);
  }

  return { pricingMap, providerMap };
}

export async function getBerriPricingMap(): Promise<Map<string, NormalizedPricingModel>> {
  if (!dataPromise) {
    dataPromise = fetchBerriData();
  }
  return (await dataPromise).pricingMap;
}

export async function getBerriModelProviderMap(): Promise<Map<string, string>> {
  if (!dataPromise) {
    dataPromise = fetchBerriData();
  }
  return (await dataPromise).providerMap;
}

export function clearBerriCache(): void {
  dataPromise = null;
}
