import { loadProviderPricingMappingsConfig } from "../data/configLoader.js";
import { normalizeModelId, resolveCanonicalModelId } from "../data/modelResolver.js";
import type { NormalizedPricingModel } from "../types.js";

const BERRI_URL =
  "https://raw.githubusercontent.com/BerriAI/litellm/main/model_prices_and_context_window.json";
type BerriData = {
  pricingMap: Map<string, NormalizedPricingModel>;
  providerMap: Map<string, string>;
};

let dataPromise: Promise<BerriData> | null = null;

function parseNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function toCostPer1M(entry: Record<string, unknown>, tokenKey: string, per1kKey: string) {
  const tokenCost = parseNumber(entry[tokenKey]);
  if (tokenCost !== null) return tokenCost * 1_000_000;
  const per1kCost = parseNumber(entry[per1kKey]);
  if (per1kCost !== null) return per1kCost * 1_000;
  return 0;
}

function addModel(
  map: Map<string, NormalizedPricingModel>,
  modelId: string,
  data: NormalizedPricingModel,
) {
  const normalized = normalizeModelId(modelId);
  map.set(normalized, data);
  map.set(resolveCanonicalModelId(normalized), data);
}

function addProvider(
  map: Map<string, string>,
  modelId: string,
  provider: string,
) {
  const normalized = normalizeModelId(modelId);
  const canonical = resolveCanonicalModelId(normalized);
  map.set(normalized, provider);
  map.set(canonical, provider);
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
  const pricingMappings = loadProviderPricingMappingsConfig().berri;
  void pricingMappings;

  const pricingMap = new Map<string, NormalizedPricingModel>();
  const providerMap = new Map<string, string>();
  for (const [key, value] of Object.entries(payload)) {
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

    const normalized: NormalizedPricingModel = {
      modelId: resolveCanonicalModelId(key),
      inputCostPer1M,
      outputCostPer1M,
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
