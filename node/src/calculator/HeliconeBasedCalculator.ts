import {
  extractResponseMetadata,
  extractTokenUsage,
} from "../data/responseTransformer.js";
import { stripProviderPrefix } from "../data/modelResolver.js";
import { ModelNotFoundError, PricingUnavailableError } from "../errors.js";
import {
  getHeliconePricingMap,
  heliconePatternLookup,
} from "../providers/heliconeClient.js";
import type { CostResult } from "../types.js";
import { Calculator } from "./Calculator.js";

function round12(value: number): number {
  return Number(value.toFixed(12));
}

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

    const cost =
      (usage.inputTokens / 1_000_000) * pricing.inputCostPer1M +
      (usage.outputTokens / 1_000_000) * pricing.outputCostPer1M;

    return { currency: "USD", cost: round12(cost) };
  }
}
