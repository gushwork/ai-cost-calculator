import {
  extractResponseModel,
  extractTokenUsage,
  getInputIncludesCacheRead,
} from "../data/responseTransformer.js";
import { stripProviderPrefix } from "../data/modelResolver.js";
import { ModelNotFoundError, PricingUnavailableError } from "../errors.js";
import { getJinaPricingMap } from "../providers/jinaClient.js";
import type { CostResult } from "../types.js";
import { Calculator } from "./Calculator.js";
import { computeCost } from "./computeCost.js";

export class JinaBasedCalculator extends Calculator {
  static override async getCost(response: unknown): Promise<CostResult> {
    const model = extractResponseModel(response);
    const usage = extractTokenUsage(response, "jina_ai");
    const pricingMap = await getJinaPricingMap();
    const normalizedModel = model.trim().toLowerCase();
    const pricing =
      pricingMap.get(normalizedModel) ??
      pricingMap.get(stripProviderPrefix(normalizedModel));

    if (!pricing) {
      throw new ModelNotFoundError(`Model "${model}" not found in Jina pricing.`);
    }
    if (pricing.inputCostPer1M < 0 || pricing.outputCostPer1M < 0) {
      throw new PricingUnavailableError(
        `Model "${model}" has invalid Jina pricing values.`,
      );
    }

    const cost = computeCost(usage, pricing, getInputIncludesCacheRead("jina_ai"));
    return { currency: "USD", cost };
  }
}
