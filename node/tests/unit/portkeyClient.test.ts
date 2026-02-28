import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { parsePortkeyModelsFromHtml } from "../../src/providers/portkeyClient.js";

describe("portkeyClient parser", () => {
  it("parses pricing models from embedded next data", () => {
    const fixture = readFileSync(
      path.resolve(
        path.dirname(fileURLToPath(import.meta.url)),
        "../fixtures/portkey-models.html",
      ),
      "utf-8",
    );

    const parsed = parsePortkeyModelsFromHtml(fixture);
    const mini = parsed.get("gpt-4o-mini");

    expect(mini).toBeDefined();
    expect(mini?.inputCostPer1M).toBe(150);
    expect(mini?.outputCostPer1M).toBe(600);
  });
});
