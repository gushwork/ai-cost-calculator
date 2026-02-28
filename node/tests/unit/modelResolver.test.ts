import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { loadModelAliasesConfig } from "../../src/data/configLoader.js";
import {
  normalizeModelId,
  resolveCanonicalModelId,
} from "../../src/data/modelResolver.js";

process.env.LLMCOST_CONFIGS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
  "configs",
);

describe("modelResolver", () => {
  it("normalizes model IDs", () => {
    expect(normalizeModelId("  OPENAI/GPT-4O-MINI  ")).toBe("openai/gpt-4o-mini");
    expect(normalizeModelId("\nGEMINI-1.5-PRO\t")).toBe("gemini-1.5-pro");
  });

  it("resolves all configured aliases to their canonical models", () => {
    const aliases = loadModelAliasesConfig().normalized;
    for (const [alias, canonical] of Object.entries(aliases)) {
      expect(resolveCanonicalModelId(alias)).toBe(canonical);
    }
  });

  it("keeps unknown models as normalized values", () => {
    expect(resolveCanonicalModelId("  custom-provider/model-x  ")).toBe(
      "custom-provider/model-x",
    );
  });
});
