export type CurrencyCode = "USD";

export interface CostResult {
  currency: CurrencyCode;
  cost: number;
  toolCallCost?: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

export interface CustomPricing {
  inputCostPer1M: number;
  outputCostPer1M: number;
  cacheReadCostPer1M?: number;
  cacheCreationCostPer1M?: number;
}

export interface CostOptions {
  model?: string;
  provider?: string;
  pricing?: CustomPricing;
}

export interface CalculatorInput {
  response: unknown;
}

export interface ResponseMetadata {
  model: string;
  provider: string;
}

export interface ResponseProviderMapping {
  inputTokensPaths: string[];
  outputTokensPaths: string[];
  totalTokensPaths: string[];
  cacheReadTokensPaths?: string[];
  cacheCreationTokensPaths?: string[];
  inputIncludesCacheRead?: boolean;
}

export interface ResponseMappingsConfig {
  [provider: string]: ResponseProviderMapping;
}

export interface NormalizedPricingModel {
  modelId: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  cacheReadCostPer1M?: number;
  cacheCreationCostPer1M?: number;
  toolUseSystemPromptTokens?: number;
  currency: CurrencyCode;
}
