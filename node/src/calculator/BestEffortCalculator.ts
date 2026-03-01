import { BestEffortCalculationError } from "../errors.js";
import type { CostOptions, CostResult } from "../types.js";
import { BerrilmBasedCalculator } from "./BerrilmBasedCalculator.js";
import { Calculator } from "./Calculator.js";
import { HeliconeBasedCalculator } from "./HeliconeBasedCalculator.js";
import { OpenRouterBasedCalculator } from "./OpenRouterBasedCalculator.js";
import { PortkeyBasedCalculator } from "./PortkeyBasedCalculator.js";

type StaticCalculator =
  | typeof OpenRouterBasedCalculator
  | typeof BerrilmBasedCalculator
  | typeof PortkeyBasedCalculator
  | typeof HeliconeBasedCalculator;

export class BestEffortCalculator extends Calculator {
  static calculators: StaticCalculator[] = [
    OpenRouterBasedCalculator,
    BerrilmBasedCalculator,
    PortkeyBasedCalculator,
    HeliconeBasedCalculator,
  ];

  static override async getCost(response: unknown, options?: CostOptions): Promise<CostResult> {
    const failures: Error[] = [];

    for (const calculator of BestEffortCalculator.calculators) {
      try {
        return await calculator.getCost(response, options);
      } catch (error) {
        failures.push(error instanceof Error ? error : new Error(String(error)));
      }
    }

    throw new BestEffortCalculationError(failures);
  }
}
