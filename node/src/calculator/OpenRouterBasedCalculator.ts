import {
  extractResponseMetadata,
  extractTokenUsage,
  getInputIncludesCacheRead,
} from "../data/responseTransformer.js";
import { stripProviderPrefix } from "../data/modelResolver.js";
import { ModelNotFoundError, PricingUnavailableError } from "../errors.js";
import { getOpenRouterPricingMap } from "../providers/openrouterClient.js";
import type { CostOptions, CostResult } from "../types.js";
import { Calculator } from "./Calculator.js";
import { computeCost } from "./computeCost.js";

export class OpenRouterBasedCalculator extends Calculator {
  static override async getCost(response: unknown, options?: CostOptions): Promise<CostResult> {
    const { model, provider } = await extractResponseMetadata(response, options);
    const usage = extractTokenUsage(response, provider);
    const pricingMap = await getOpenRouterPricingMap();
    const normalizedModel = model.trim().toLowerCase();
    const pricing =
      pricingMap.get(normalizedModel) ??
      pricingMap.get(stripProviderPrefix(normalizedModel));

    if (!pricing) {
      throw new ModelNotFoundError(`Model "${model}" not found in OpenRouter pricing.`);
    }
    if (pricing.inputCostPer1M < 0 || pricing.outputCostPer1M < 0) {
      throw new PricingUnavailableError(
        `Model "${model}" has invalid OpenRouter pricing values.`,
      );
    }

    const cost = computeCost(usage, pricing, getInputIncludesCacheRead(provider));
    return { currency: "USD", cost };
  }
}
