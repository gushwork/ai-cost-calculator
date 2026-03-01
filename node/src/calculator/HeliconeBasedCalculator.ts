import { getHeliconePricingMap, heliconePatternLookup } from "../providers/heliconeClient.js";
import { Calculator } from "./Calculator.js";

export class HeliconeBasedCalculator extends Calculator {
  static override pricingSource = {
    name: "Helicone",
    getPricingMap: getHeliconePricingMap,
    customLookup: heliconePatternLookup,
  };
}
