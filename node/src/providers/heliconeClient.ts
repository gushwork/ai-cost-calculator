import { normalizeModelId, stripProviderPrefix } from "../data/modelResolver.js";
import type { NormalizedPricingModel } from "../types.js";

const HELICONE_URL = "https://www.helicone.ai/api/llm-costs";

type HeliconeEntry = {
  provider?: string;
  model?: string;
  operator?: string;
  input_cost_per_1m?: unknown;
  output_cost_per_1m?: unknown;
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

function modelMatches(
  candidate: string,
  pattern: string,
  operator: string,
): boolean {
  switch (operator) {
    case "equals":
      return candidate === pattern;
    case "startsWith":
      return candidate.startsWith(pattern);
    case "includes":
      return candidate.includes(pattern);
    default:
      return candidate === pattern;
  }
}

async function fetchHeliconePricing(): Promise<
  Map<string, NormalizedPricingModel>
> {
  const response = await fetch(HELICONE_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Helicone pricing: ${response.status}`);
  }

  const payload = (await response.json()) as { data?: HeliconeEntry[] };
  const entries = Array.isArray(payload.data) ? payload.data : [];

  const exactEntries: HeliconeEntry[] = [];
  const patternEntries: HeliconeEntry[] = [];

  for (const entry of entries) {
    if (!entry.model) continue;
    if (entry.operator === "equals" || !entry.operator) {
      exactEntries.push(entry);
    } else {
      patternEntries.push(entry);
    }
  }

  const out = new Map<string, NormalizedPricingModel>();

  for (const entry of exactEntries) {
    const modelRaw = entry.model!;
    const inputCostPer1M = parseNumeric(entry.input_cost_per_1m) ?? 0;
    const outputCostPer1M = parseNumeric(entry.output_cost_per_1m) ?? 0;
    if (inputCostPer1M <= 0 && outputCostPer1M <= 0) continue;

    const normalizedId = normalizeModelId(modelRaw);
    const bare = stripProviderPrefix(normalizedId);
    const pricingEntry: NormalizedPricingModel = {
      modelId: bare,
      inputCostPer1M,
      outputCostPer1M,
      currency: "USD",
    };

    out.set(normalizedId, pricingEntry);
    if (bare !== normalizedId) out.set(bare, pricingEntry);
  }

  // Store pattern entries for prefix/includes matching during lookup
  (out as HeliconeMap)._patterns = patternEntries;

  return out;
}

type HeliconeMap = Map<string, NormalizedPricingModel> & {
  _patterns?: HeliconeEntry[];
};

export function heliconePatternLookup(
  map: Map<string, NormalizedPricingModel>,
  modelId: string,
): NormalizedPricingModel | undefined {
  const patterns = (map as HeliconeMap)._patterns;
  if (!patterns) return undefined;

  const normalized = normalizeModelId(modelId);
  for (const entry of patterns) {
    if (!entry.model || !entry.operator) continue;
    if (modelMatches(normalized, normalizeModelId(entry.model), entry.operator)) {
      const inputCostPer1M = parseNumeric(entry.input_cost_per_1m) ?? 0;
      const outputCostPer1M = parseNumeric(entry.output_cost_per_1m) ?? 0;
      if (inputCostPer1M <= 0 && outputCostPer1M <= 0) continue;
      return {
        modelId: normalized,
        inputCostPer1M,
        outputCostPer1M,
        currency: "USD",
      };
    }
  }
  return undefined;
}

export async function getHeliconePricingMap(): Promise<
  Map<string, NormalizedPricingModel>
> {
  if (!cachePromise) {
    cachePromise = fetchHeliconePricing();
  }
  return cachePromise;
}

export function clearHeliconeCache(): void {
  cachePromise = null;
}
