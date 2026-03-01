import type { CostOptions, CostResult } from "../types.js";

export abstract class Calculator {
  static async getCost(_response: unknown, _options?: CostOptions): Promise<CostResult> {
    throw new Error("getCost is not implemented");
  }
}
