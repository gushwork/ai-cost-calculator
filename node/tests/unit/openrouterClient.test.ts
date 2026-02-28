import { afterEach, describe, expect, it, vi } from "vitest";

import {
  clearOpenRouterCache,
  getOpenRouterPricingMap,
} from "../../src/providers/openrouterClient.js";

describe("openrouterClient caching", () => {
  afterEach(() => {
    clearOpenRouterCache();
    vi.restoreAllMocks();
  });

  it("deduplicates in-flight fetches", async () => {
    const payload = {
      data: [
        {
          id: "openai/gpt-4o-mini",
          pricing: {
            prompt: "0.00000015",
            completion: "0.0000006",
          },
        },
      ],
    };

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(JSON.stringify(payload), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );

    const [a, b] = await Promise.all([getOpenRouterPricingMap(), getOpenRouterPricingMap()]);
    expect(a.get("openai/gpt-4o-mini")?.inputCostPer1M).toBe(0.15);
    expect(b.get("gpt-4o-mini")?.outputCostPer1M).toBe(0.6);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("parses currency-prefixed pricing and canonical slug aliases", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          data: [
            {
              id: "openai/gpt-4.1-mini",
              canonical_slug: "gpt-4.1-mini",
              pricing: {
                prompt: "$0.000001",
                completion: "0.000002",
              },
            },
          ],
        }),
        { status: 200 },
      ),
    );

    const pricing = await getOpenRouterPricingMap();
    expect(pricing.get("openai/gpt-4.1-mini")?.inputCostPer1M).toBe(1);
    expect(pricing.get("gpt-4.1-mini")?.outputCostPer1M).toBe(2);
  });
});
