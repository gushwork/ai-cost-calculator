import { BestEffortCalculator } from "ai-cost-calculator";

const response = {
  model: "gpt-4o-mini",
  usage: {
    prompt_tokens: 1000,
    completion_tokens: 500,
    total_tokens: 1500,
  },
};

const result = await BestEffortCalculator.getCost(response);

if (result.currency !== "USD") {
  throw new Error(`Expected currency "USD", got "${result.currency}"`);
}
if (typeof result.cost !== "number" || result.cost <= 0) {
  throw new Error(`Expected positive cost, got ${result.cost}`);
}

console.log("Post-publish smoke test passed:", result);
