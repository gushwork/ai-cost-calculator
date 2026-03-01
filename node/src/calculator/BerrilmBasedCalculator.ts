import { getBerriPricingMap } from "../providers/berriClient.js";
import { Calculator } from "./Calculator.js";

export class BerrilmBasedCalculator extends Calculator {
  static override pricingSource = {
    name: "Berri",
    getPricingMap: getBerriPricingMap,
  };
}
