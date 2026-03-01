import { getOpenRouterPricingMap } from "../providers/openrouterClient.js";
import { Calculator } from "./Calculator.js";

export class OpenRouterBasedCalculator extends Calculator {
  static override pricingSource = {
    name: "OpenRouter",
    getPricingMap: getOpenRouterPricingMap,
  };
}
