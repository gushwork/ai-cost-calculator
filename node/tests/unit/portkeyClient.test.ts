import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { getPortkeyPricingMap, clearPortkeyCache } from "../../src/providers/portkeyClient.js";

function buildMockPortkeyJson(): Record<string, unknown> {
  return {
    default: {
      pricing_config: {
        pay_as_you_go: {
          request_token: { price: 0 },
          response_token: { price: 0 },
        },
      },
    },
    "gpt-4o-mini": {
      pricing_config: {
        pay_as_you_go: {
          request_token: { price: 0.00000015 },
          response_token: { price: 0.0000006 },
        },
      },
    },
  };
}

describe("portkeyClient JSON API", () => {
  afterEach(() => {
    clearPortkeyCache();
    mock.restore();
  });

  it("parses pricing from portkey JSON API", async () => {
    spyOn(globalThis, "fetch").mockImplementation(
      (() =>
        Promise.resolve(
          new Response(JSON.stringify(buildMockPortkeyJson()), { status: 200 }),
        )) as unknown as typeof fetch,
    );

    const map = await getPortkeyPricingMap();
    const mini = map.get("gpt-4o-mini");

    expect(mini).toBeDefined();
    expect(mini?.inputCostPer1M).toBe(0.15);
    expect(mini?.outputCostPer1M).toBe(0.6);
  });
});
