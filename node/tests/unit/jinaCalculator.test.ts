import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import { JinaBasedCalculator } from "../../src/calculator/JinaBasedCalculator.js";
import { ModelNotFoundError } from "../../src/errors.js";
import { clearJinaCache } from "../../src/providers/jinaClient.js";

describe("JinaBasedCalculator", () => {
  afterEach(() => {
    clearJinaCache();
    mock.restore();
  });

  it("calculates Jina cost from usage and pricing map", async () => {
    spyOn(globalThis, "fetch").mockImplementation(
      (async () => {
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

    const result = await JinaBasedCalculator.getCost({
      model: "jina-reranker-v3",
      usage: {
        input_tokens: 1000,
        output_tokens: 500,
        total_tokens: 1500,
      },
    });

    expect(result).toEqual({
      currency: "USD",
      cost: 0.005,
    });
  });

  it("throws ModelNotFoundError when model is absent from Jina map", async () => {
    spyOn(globalThis, "fetch").mockImplementation(
      (async () =>
        new Response("Pricing config not found for the given model", {
          status: 404,
        })) as unknown as typeof fetch,
    );

    await expect(
      JinaBasedCalculator.getCost({
        model: "unknown-jina-model",
        usage: {
          input_tokens: 1000,
          output_tokens: 0,
          total_tokens: 1000,
        },
      }),
    ).rejects.toBeInstanceOf(ModelNotFoundError);
  });
});
