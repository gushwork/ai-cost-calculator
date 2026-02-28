import { normalizeModelId, resolveCanonicalModelId } from "../data/modelResolver.js";
import type { NormalizedPricingModel } from "../types.js";

const PORTKEY_URL = "https://portkey.ai/models";
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

function parseRateToPer1M(value: unknown): number | null {
  const numeric = parseNumeric(value);
  if (numeric === null) return null;
  return numeric;
}

function collectObjectsWithPricing(node: unknown, out: Record<string, unknown>[]) {
  if (Array.isArray(node)) {
    for (const item of node) collectObjectsWithPricing(item, out);
    return;
  }
  if (node === null || typeof node !== "object") return;

  const obj = node as Record<string, unknown>;
  const hasModelId = typeof obj.model === "string" || typeof obj.id === "string" || typeof obj.name === "string";
  const hasPricing =
    obj.pricing !== undefined ||
    obj.input !== undefined ||
    obj.output !== undefined ||
    obj.inputCostPer1M !== undefined ||
    obj.outputCostPer1M !== undefined;
  if (hasModelId && hasPricing) {
    out.push(obj);
  }

  for (const value of Object.values(obj)) {
    collectObjectsWithPricing(value, out);
  }
}

function parseEmbeddedJson(html: string): unknown[] {
  const extracted: unknown[] = [];

  const nextDataRegex =
    /<script[^>]*id="__NEXT_DATA__"[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(nextDataRegex)) {
    try {
      extracted.push(JSON.parse(match[1]));
    } catch {
      // ignore malformed chunks
    }
  }

  const genericJsonRegex =
    /<script[^>]*type="application\/json"[^>]*>([\s\S]*?)<\/script>/gi;
  for (const match of html.matchAll(genericJsonRegex)) {
    try {
      extracted.push(JSON.parse(match[1]));
    } catch {
      // ignore malformed chunks
    }
  }

  return extracted;
}

export function parsePortkeyModelsFromHtml(html: string): Map<string, NormalizedPricingModel> {
  const candidates: Record<string, unknown>[] = [];
  for (const payload of parseEmbeddedJson(html)) {
    collectObjectsWithPricing(payload, candidates);
  }

  const out = new Map<string, NormalizedPricingModel>();
  for (const candidate of candidates) {
    const modelRaw =
      (candidate.id as string | undefined) ??
      (candidate.model as string | undefined) ??
      (candidate.name as string | undefined);
    if (!modelRaw) continue;

    const pricing = (candidate.pricing ?? {}) as Record<string, unknown>;
    const inputCostPer1M =
      parseRateToPer1M(
        pricing.inputCostPer1M ?? pricing.input ?? candidate.inputCostPer1M ?? candidate.input,
      ) ?? 0;
    const outputCostPer1M =
      parseRateToPer1M(
        pricing.outputCostPer1M ?? pricing.output ?? candidate.outputCostPer1M ?? candidate.output,
      ) ?? inputCostPer1M;

    if (inputCostPer1M <= 0 && outputCostPer1M <= 0) continue;

    const modelId = resolveCanonicalModelId(modelRaw);
    const normalized: NormalizedPricingModel = {
      modelId,
      inputCostPer1M,
      outputCostPer1M,
      currency: "USD",
    };

    out.set(normalizeModelId(modelRaw), normalized);
    out.set(modelId, normalized);
  }

  return out;
}

async function fetchPortkeyPricing(): Promise<Map<string, NormalizedPricingModel>> {
  const response = await fetch(PORTKEY_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch Portkey models page: ${response.status}`);
  }

  const html = await response.text();
  return parsePortkeyModelsFromHtml(html);
}

export async function getPortkeyPricingMap(): Promise<Map<string, NormalizedPricingModel>> {
  if (!cachePromise) {
    cachePromise = fetchPortkeyPricing();
  }
  return cachePromise;
}

export function clearPortkeyCache(): void {
  cachePromise = null;
}
