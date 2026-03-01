import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

import {
  JINA_MODELS,
  clearJinaCache,
  getJinaPricingMap,
} from "../../src/providers/jinaClient.js";
import { clearAliasCache } from "../../src/data/aliasBuilder.js";

describe("jinaClient", () => {
  beforeEach(() => {
    clearJinaCache();
    clearAliasCache();
  });

  afterEach(() => {
    clearJinaCache();
    clearAliasCache();
    mock.restore();
  });

  it("fetches Jina pricing and converts per-token rates to per-1M", async () => {
    spyOn(globalThis, "fetch").mockImplementation(
      (async (_input: RequestInfo | URL) => {
        return new Response(
          JSON.stringify({
            pay_as_you_go: {
              request_token: { price: 0.000005 },
              response_token: { price: 0 },
            },
            currency: "USD",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as unknown as typeof fetch,
    );

    const pricingMap = await getJinaPricingMap();
    const rerankerV3 = pricingMap.get("jina-reranker-v3");

    expect(rerankerV3).toBeDefined();
    expect(rerankerV3?.inputCostPer1M).toBe(5);
    expect(rerankerV3?.outputCostPer1M).toBe(0);
  });

  it("deduplicates in-flight cache fetches", async () => {
    const fetchMock = spyOn(globalThis, "fetch").mockImplementation(
      (async (_input: RequestInfo | URL) => {
        return new Response(
          JSON.stringify({
            pay_as_you_go: {
              request_token: { price: 0.000002 },
              response_token: { price: 0 },
            },
            currency: "USD",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as unknown as typeof fetch,
    );

    await Promise.all([getJinaPricingMap(), getJinaPricingMap()]);
    expect(fetchMock).toHaveBeenCalledTimes(JINA_MODELS.length);
  });

  it("skips models that return 404 pricing config", async () => {
    spyOn(globalThis, "fetch").mockImplementation(
      (async (input: RequestInfo | URL) => {
        const url = String(input);
        const model = decodeURIComponent(url.split("/").pop() ?? "");
        if (model === "jina-colbert-v2") {
          return new Response("Pricing config not found for the given model", { status: 404 });
        }

        return new Response(
          JSON.stringify({
            pay_as_you_go: {
              request_token: { price: 0.000002 },
              response_token: { price: 0 },
            },
            currency: "USD",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }) as unknown as typeof fetch,
    );

    const pricingMap = await getJinaPricingMap();
    expect(pricingMap.has("jina-colbert-v2")).toBe(false);
    expect(pricingMap.has("jina-reranker-v3")).toBe(true);
  });
});
