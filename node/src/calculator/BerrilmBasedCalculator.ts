import {
  extractResponseMetadata,
  extractTokenUsage,
  getInputIncludesCacheRead,
} from "../data/responseTransformer.js";
import { stripProviderPrefix } from "../data/modelResolver.js";
import { ModelNotFoundError, PricingUnavailableError } from "../errors.js";
import { getBerriPricingMap } from "../providers/berriClient.js";
import type { CostOptions, CostResult } from "../types.js";
import { Calculator } from "./Calculator.js";
import { computeCost } from "./computeCost.js";

export class BerrilmBasedCalculator extends Calculator {
  static override async getCost(response: unknown, options?: CostOptions): Promise<CostResult> {
    const { model, provider } = await extractResponseMetadata(response, options);
    const usage = extractTokenUsage(response, provider);
    const pricingMap = await getBerriPricingMap();
    const normalizedModel = model.trim().toLowerCase();
    const pricing =
      pricingMap.get(normalizedModel) ??
      pricingMap.get(stripProviderPrefix(normalizedModel));

    if (!pricing) {
      throw new ModelNotFoundError(`Model "${model}" not found in Berri pricing.`);
    }
    if (pricing.inputCostPer1M < 0 || pricing.outputCostPer1M < 0) {
      throw new PricingUnavailableError(
        `Model "${model}" has invalid Berri pricing values.`,
      );
    }

    const cost = computeCost(usage, pricing, getInputIncludesCacheRead(provider));
    return { currency: "USD", cost };
  }
}
