import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import {
  normalizeModelId,
  resolveCanonicalModelId,
} from "../../src/data/modelResolver.js";
import { clearAliasCache } from "../../src/data/aliasBuilder.js";

function buildMockAliasPayload(): Record<string, Record<string, unknown>> {
  return {
    "openai/gpt-4o-mini": {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
      litellm_provider: "openai",
    },
    "gpt-4o-mini": {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
      litellm_provider: "openai",
    },
    "anthropic/claude-3-5-sonnet": {
      input_cost_per_token: 0.000003,
      output_cost_per_token: 0.000006,
      litellm_provider: "anthropic",
    },
  };
}

describe("modelResolver", () => {
  afterEach(() => {
    clearAliasCache();
    mock.restore();
  });

  it("normalizes model IDs", () => {
    expect(normalizeModelId("  OPENAI/GPT-4O-MINI  ")).toBe("openai/gpt-4o-mini");
    expect(normalizeModelId("\nGEMINI-1.5-PRO\t")).toBe("gemini-1.5-pro");
  });

  it("resolves provider-prefixed aliases to bare model name", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(buildMockAliasPayload()), { status: 200 }),
    );

    const result = await resolveCanonicalModelId("openai/gpt-4o-mini");
    expect(result).toBe("gpt-4o-mini");
  });

  it("keeps unknown models as normalized values", async () => {
    spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(buildMockAliasPayload()), { status: 200 }),
    );

    const result = await resolveCanonicalModelId("  custom-provider/model-x  ");
    expect(result).toBe("custom-provider/model-x");
  });
});
