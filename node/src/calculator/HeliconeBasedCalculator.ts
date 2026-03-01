import {
  extractResponseMetadata,
  extractTokenUsage,
  getInputIncludesCacheRead,
} from "../data/responseTransformer.js";
import { stripProviderPrefix } from "../data/modelResolver.js";
import { ModelNotFoundError, PricingUnavailableError } from "../errors.js";
import {
  getHeliconePricingMap,
  heliconePatternLookup,
} from "../providers/heliconeClient.js";
import type { CostResult } from "../types.js";
import { Calculator } from "./Calculator.js";
import { computeCost } from "./computeCost.js";

export class HeliconeBasedCalculator extends Calculator {
  static override async getCost(response: unknown): Promise<CostResult> {
    const { model, provider } = await extractResponseMetadata(response);
    const usage = extractTokenUsage(response, provider);
    const pricingMap = await getHeliconePricingMap();
    const normalizedModel = model.trim().toLowerCase();
    const bareModel = stripProviderPrefix(normalizedModel);
    const pricing =
      pricingMap.get(normalizedModel) ??
      pricingMap.get(bareModel) ??
      heliconePatternLookup(pricingMap, normalizedModel);

    if (!pricing) {
      throw new ModelNotFoundError(
        `Model "${model}" not found in Helicone pricing.`,
      );
    }
    if (pricing.inputCostPer1M < 0 || pricing.outputCostPer1M < 0) {
      throw new PricingUnavailableError(
        `Model "${model}" has invalid Helicone pricing values.`,
      );
    }

    const cost = computeCost(usage, pricing, getInputIncludesCacheRead(provider));
    return { currency: "USD", cost };
  }
}
