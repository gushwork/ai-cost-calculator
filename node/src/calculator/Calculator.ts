import type { CostResult } from "../types.js";

export abstract class Calculator {
  static async getCost(_response: unknown): Promise<CostResult> {
    throw new Error("getCost is not implemented");
  }
}
