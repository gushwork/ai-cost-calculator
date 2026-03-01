export type CurrencyCode = "USD";

export interface CostResult {
  currency: CurrencyCode;
  cost: number;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
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
}

export interface ResponseMappingsConfig {
  [provider: string]: ResponseProviderMapping;
}

export interface PricingProviderMapping {
  modelsPath: string;
  modelIdPaths: string[];
  inputCostPer1MPaths: string[];
  outputCostPer1MPaths: string[];
  currencyPaths?: string[];
}

export interface ProviderPricingMappingsConfig {
  [provider: string]: PricingProviderMapping;
}

export interface NormalizedPricingModel {
  modelId: string;
  inputCostPer1M: number;
  outputCostPer1M: number;
  currency: CurrencyCode;
}
