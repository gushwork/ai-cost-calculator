import { describe, expect, it } from "bun:test";

import { normalizeModelId } from "../../src/data/modelResolver.js";

describe("modelResolver", () => {
  it("normalizes model IDs", () => {
    expect(normalizeModelId("  OPENAI/GPT-4O-MINI  ")).toBe("openai/gpt-4o-mini");
    expect(normalizeModelId("\nGEMINI-1.5-PRO\t")).toBe("gemini-1.5-pro");
  });
});
