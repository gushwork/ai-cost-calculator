import type { NormalizedPricingModel, TokenUsage } from "../types.js";

function round12(value: number): number {
  return Number(value.toFixed(12));
}

export function computeCost(
  usage: TokenUsage,
  pricing: NormalizedPricingModel,
  inputIncludesCacheRead: boolean,
): number {
  const cacheRead = usage.cacheReadTokens ?? 0;
  const cacheCreation = usage.cacheCreationTokens ?? 0;

  const effectiveInput = inputIncludesCacheRead
    ? Math.max(0, usage.inputTokens - cacheRead)
    : usage.inputTokens;

  const cacheReadRate = pricing.cacheReadCostPer1M ?? pricing.inputCostPer1M;
  const cacheCreationRate =
    pricing.cacheCreationCostPer1M ?? pricing.inputCostPer1M;

  return round12(
    (effectiveInput / 1_000_000) * pricing.inputCostPer1M +
      (cacheRead / 1_000_000) * cacheReadRate +
      (cacheCreation / 1_000_000) * cacheCreationRate +
      (usage.outputTokens / 1_000_000) * pricing.outputCostPer1M,
  );
}
