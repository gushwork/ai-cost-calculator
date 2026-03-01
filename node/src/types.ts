export type CurrencyCode = "USD";

export interface CostResult {
  currency: CurrencyCode;
  cost: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cacheReadTokens?: number;
  cacheCreationTokens?: number;
}

export interface CostOptions {
  model?: string;
  provider?: string;
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

export interface PricingProviderMapping {
  modelsPath: string;
  modelIdPaths: string[];
  inputCostPer1MPaths: string[];
  outputCostPer1MPaths: string[];
  cacheReadCostPer1MPaths?: string[];
  cacheCreationCostPer1MPaths?: string[];
  currencyPaths?: string[];
}

export interface ProviderPricingMappingsConfig {
  [provider: string]: PricingProviderMapping;
}

export interface NormalizedPricingModel {
  modelId: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  cacheReadCostPer1M?: number;
  cacheCreationCostPer1M?: number;
  currency: CurrencyCode;
}
