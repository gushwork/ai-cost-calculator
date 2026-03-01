import {
  detectToolCalls,
  extractResponseMetadata,
  extractTokenUsage,
  getInputIncludesCacheRead,
} from "../data/responseTransformer.js";
import { normalizeModelId, stripProviderPrefix } from "../data/modelResolver.js";
import { ModelNotFoundError, PricingUnavailableError } from "../errors.js";
import type { CostOptions, CostResult, NormalizedPricingModel } from "../types.js";
import { computeCost, computeToolCallCost } from "./computeCost.js";

export interface PricingSource {
  name: string;
  getPricingMap: () => Promise<Map<string, NormalizedPricingModel>>;
  customLookup?: (map: Map<string, NormalizedPricingModel>, modelId: string) => NormalizedPricingModel | undefined;
}

export abstract class Calculator {
  static pricingSource: PricingSource;

  static async getCost(
    this: typeof Calculator & { pricingSource: PricingSource },
    response: unknown,
    options?: CostOptions,
  ): Promise<CostResult> {
    const { name, getPricingMap, customLookup } = this.pricingSource;
    const { model, provider } = await extractResponseMetadata(response, options);
    const usage = extractTokenUsage(response, provider);
    const pricingMap = await getPricingMap();
    const normalizedModel = normalizeModelId(model);
    const bareModel = stripProviderPrefix(normalizedModel);
    const pricing =
      pricingMap.get(normalizedModel) ??
      pricingMap.get(bareModel) ??
      customLookup?.(pricingMap, normalizedModel);

    if (!pricing) {
      throw new ModelNotFoundError(`Model "${model}" not found in ${name} pricing.`);
    }
    if (pricing.inputCostPer1M < 0 || pricing.outputCostPer1M < 0) {
      throw new PricingUnavailableError(
        `Model "${model}" has invalid ${name} pricing values.`,
      );
    }

    const baseCost = computeCost(usage, pricing, getInputIncludesCacheRead(provider));
    const toolCallCost = computeToolCallCost(detectToolCalls(response), pricing);
    const cost = toolCallCost !== undefined ? baseCost + toolCallCost : baseCost;
    const result: CostResult = { currency: "USD", cost };
    if (toolCallCost !== undefined) result.toolCallCost = toolCallCost;
    return result;
  }
}
