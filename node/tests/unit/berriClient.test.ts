import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearBerriCache,
  getBerriModelProviderMap,
  getBerriPricingMap,
} from "../../src/providers/berriClient.js";

describe("berriClient caching", () => {
  afterEach(() => {
    clearBerriCache();
    vi.restoreAllMocks();
  });

  it("deduplicates in-flight fetches", async () => {
    const payload = {
      "gpt-4o-mini": {
        input_cost_per_token: 0.00000015,
        output_cost_per_token: 0.0000006,
        litellm_provider: "openai",
      },
    };

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const [a, b] = await Promise.all([getBerriPricingMap(), getBerriPricingMap()]);
    expect(a.get("gpt-4o-mini")?.inputCostPer1M).toBe(0.15);
    expect(b.get("gpt-4o-mini")?.outputCostPer1M).toBe(0.6);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("exposes model to provider mapping from first fetch", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "openai/gpt-4o-mini": {
            input_cost_per_token: 0.00000015,
            output_cost_per_token: 0.0000006,
            litellm_provider: "openai",
          },
        }),
        { status: 200 },
      ),
    );

    const providerMap = await getBerriModelProviderMap();
    expect(providerMap.get("openai/gpt-4o-mini")).toBe("openai");
    expect(providerMap.get("gpt-4o-mini")).toBe("openai");
  });
});
