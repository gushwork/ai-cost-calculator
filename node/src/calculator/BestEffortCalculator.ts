import { BestEffortCalculationError } from "../errors.js";
import type { CostResult } from "../types.js";
import { BerrilmBasedCalculator } from "./BerrilmBasedCalculator.js";
import { Calculator } from "./Calculator.js";
import { OpenRouterBasedCalculator } from "./OpenRouterBasedCalculator.js";
import { PortkeyBasedCalculator } from "./PortkeyBasedCalculator.js";

type StaticCalculator =
  | typeof OpenRouterBasedCalculator
  | typeof BerrilmBasedCalculator
  | typeof PortkeyBasedCalculator;

export class BestEffortCalculator extends Calculator {
  static calculators: StaticCalculator[] = [
    OpenRouterBasedCalculator,
    BerrilmBasedCalculator,
    PortkeyBasedCalculator,
  ];

  static override async getCost(response: unknown): Promise<CostResult> {
    const failures: Error[] = [];

    for (const calculator of BestEffortCalculator.calculators) {
      try {
        return await calculator.getCost(response);
      } catch (error) {
        failures.push(error as Error);
      }
    }

    throw new BestEffortCalculationError(failures);
  }
}
