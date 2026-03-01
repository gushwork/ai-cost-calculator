import type { NormalizedPricingModel, TokenUsage } from "../types.js";

function round12(value: number): number {
  return Number(value.toFixed(12));
}

export function computeCost(
  usage: TokenUsage,
  pricing: NormalizedPricingModel,
  inputIncludesCacheRead: boolean,
): number {
  const inputTokens = Math.max(0, usage.inputTokens);
  const outputTokens = Math.max(0, usage.outputTokens);
  const cacheRead = Math.max(0, usage.cacheReadTokens ?? 0);
  const cacheCreation = Math.max(0, usage.cacheCreationTokens ?? 0);

  const effectiveInput = inputIncludesCacheRead
    ? Math.max(0, inputTokens - cacheRead)
    : inputTokens;

  const cacheReadRate = pricing.cacheReadCostPer1M ?? pricing.inputCostPer1M;
  const cacheCreationRate =
    pricing.cacheCreationCostPer1M ?? pricing.inputCostPer1M;

  return round12(
    (effectiveInput / 1_000_000) * pricing.inputCostPer1M +
      (cacheRead / 1_000_000) * cacheReadRate +
      (cacheCreation / 1_000_000) * cacheCreationRate +
      (outputTokens / 1_000_000) * pricing.outputCostPer1M,
  );
}

export function computeToolCallCost(
  hasToolCalls: boolean,
  pricing: NormalizedPricingModel,
): number | undefined {
  if (!hasToolCalls || !pricing.toolUseSystemPromptTokens) return undefined;
  return round12(
    (pricing.toolUseSystemPromptTokens / 1_000_000) * pricing.inputCostPer1M,
  );
}
