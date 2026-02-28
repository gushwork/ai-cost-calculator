export class LlmcostError extends Error {
  constructor(message: string) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class UsageNotFoundError extends LlmcostError {}
export class ModelNotFoundError extends LlmcostError {}
export class PricingUnavailableError extends LlmcostError {}
export class ModelInferenceError extends LlmcostError {}
export class ProviderInferenceError extends LlmcostError {}

export class BestEffortCalculationError extends LlmcostError {
  readonly causes: Error[];

  constructor(causes: Error[]) {
    super(
      `All calculators failed: ${causes.map((cause) => cause.message).join("; ")}`,
    );
    this.causes = causes;
  }
}
