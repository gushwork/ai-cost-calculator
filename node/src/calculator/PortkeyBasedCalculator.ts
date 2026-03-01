import { getPortkeyPricingMap } from "../providers/portkeyClient.js";
import { Calculator } from "./Calculator.js";

export class PortkeyBasedCalculator extends Calculator {
  static override pricingSource = {
    name: "Portkey",
    getPricingMap: getPortkeyPricingMap,
  };
}
