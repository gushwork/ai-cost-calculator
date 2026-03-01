import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

import { BestEffortCalculator } from "../../src/calculator/BestEffortCalculator.js";
import { BerrilmBasedCalculator } from "../../src/calculator/BerrilmBasedCalculator.js";
import { OpenRouterBasedCalculator } from "../../src/calculator/OpenRouterBasedCalculator.js";
import { PortkeyBasedCalculator } from "../../src/calculator/PortkeyBasedCalculator.js";
import { clearBerriCache } from "../../src/providers/berriClient.js";
import { clearHeliconeCache } from "../../src/providers/heliconeClient.js";
import { clearOpenRouterCache } from "../../src/providers/openrouterClient.js";
import { clearPortkeyCache } from "../../src/providers/portkeyClient.js";

const response = {
  model: "gpt-4o-mini",
  usage: {
    prompt_tokens: 1000,
    completion_tokens: 500,
    total_tokens: 1500,
  },
};

describe("calculators", () => {
  beforeEach(() => {
    clearBerriCache();
    clearOpenRouterCache();
    clearPortkeyCache();
    clearHeliconeCache();
  });

  afterEach(() => {
    clearBerriCache();
    clearOpenRouterCache();
    clearPortkeyCache();
    clearHeliconeCache();
    mock.restore();
  });

  it("calculates cost from berri data", async () => {
    spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "gpt-4o-mini": {
            input_cost_per_token: 0.00000015,
            output_cost_per_token: 0.0000006,
            litellm_provider: "openai",
          },
        }),
        { status: 200 },
      ),
    );

    const result = await BerrilmBasedCalculator.getCost(response);
    expect(result).toEqual({
      currency: "USD",
      cost: 0.00045,
    });
  });

  it("calculates cost from openrouter data directly", async () => {
    spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            "openai/gpt-4o-mini": {
              litellm_provider: "openai",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "openai/gpt-4o-mini",
                pricing: { prompt: "0.00000015", completion: "0.0000006" },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const result = await OpenRouterBasedCalculator.getCost({
      ...response,
      model: "openai/gpt-4o-mini",
    });
    expect(result).toEqual({
      currency: "USD",
      cost: 0.00045,
    });
  });

  it("best effort falls back from berri to portkey", async () => {
    spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            "gpt-4o-mini": {
              litellm_provider: "openai",
            },
            "other-model": {
              input_cost_per_token: 0.000001,
              output_cost_per_token: 0.000001,
              litellm_provider: "openai",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            data: [
              {
                id: "other-model",
                pricing: { prompt: "0.000001", completion: "0.000001" },
              },
            ],
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          `<!doctype html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
            {
              props: {
                pageProps: {
                  models: [
                    {
                      id: "gpt-4o-mini",
                      pricing: { inputCostPer1M: 150, outputCostPer1M: 600 },
                    },
                  ],
                },
              },
            },
          )}</script>`,
          { status: 200 },
        ),
      );

    const result = await BestEffortCalculator.getCost(response);
    expect(result).toEqual({
      currency: "USD",
      cost: 0.45,
    });
  });

  it("calculates cost from berri data with model and provider overrides", async () => {
    spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "gpt-4o-mini": {
            input_cost_per_token: 0.00000015,
            output_cost_per_token: 0.0000006,
            litellm_provider: "openai",
          },
        }),
        { status: 200 },
      ),
    );

    const result = await BerrilmBasedCalculator.getCost(
      {
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 500,
          total_tokens: 1500,
        },
      },
      { model: "gpt-4o-mini", provider: "openai" },
    );
    expect(result).toEqual({
      currency: "USD",
      cost: 0.00045,
    });
  });

  it("best effort forwards options to calculators", async () => {
    spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "gpt-4o-mini": {
            input_cost_per_token: 0.00000015,
            output_cost_per_token: 0.0000006,
            litellm_provider: "openai",
          },
        }),
        { status: 200 },
      ),
    );

    const result = await BestEffortCalculator.getCost(
      {
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 500,
          total_tokens: 1500,
        },
      },
      { model: "gpt-4o-mini", provider: "openai" },
    );
    expect(result).toEqual({
      currency: "USD",
      cost: 0.00045,
    });
  });

  it("includes toolCallCost when response has tool calls", async () => {
    spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "claude-sonnet-4-20250514": {
            input_cost_per_token: 0.000003,
            output_cost_per_token: 0.000015,
            litellm_provider: "anthropic",
            tool_use_system_prompt_tokens: 159,
          },
        }),
        { status: 200 },
      ),
    );

    const result = await BerrilmBasedCalculator.getCost({
      model: "claude-sonnet-4-20250514",
      usage: { input_tokens: 1000, output_tokens: 500, total_tokens: 1500 },
      content: [
        { type: "text", text: "Here is the weather." },
        { type: "tool_use", id: "tu_1", name: "get_weather", input: {} },
      ],
    });

    expect(result.currency).toBe("USD");
    expect(result.cost).toBeGreaterThan(0);
    expect(result.toolCallCost).toBeDefined();
    expect(result.toolCallCost).toBeCloseTo(159 * 0.000003, 10);
  });

  it("omits toolCallCost when no tool calls in response", async () => {
    spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "claude-sonnet-4-20250514": {
            input_cost_per_token: 0.000003,
            output_cost_per_token: 0.000015,
            litellm_provider: "anthropic",
            tool_use_system_prompt_tokens: 159,
          },
        }),
        { status: 200 },
      ),
    );

    const result = await BerrilmBasedCalculator.getCost({
      model: "claude-sonnet-4-20250514",
      usage: { input_tokens: 1000, output_tokens: 500, total_tokens: 1500 },
    });

    expect(result.toolCallCost).toBeUndefined();
  });

  it("calculates cost from portkey data directly", async () => {
    spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            "gpt-4o-mini": {
              litellm_provider: "openai",
            },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          `<!doctype html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
            {
              props: {
                pageProps: {
                  models: [
                    {
                      id: "gpt-4o-mini",
                      pricing: { inputCostPer1M: 100, outputCostPer1M: 200 },
                    },
                  ],
                },
              },
            },
          )}</script>`,
          { status: 200 },
        ),
      );

    const result = await PortkeyBasedCalculator.getCost(response);
    expect(result).toEqual({
      currency: "USD",
      cost: 0.2,
    });
  });
});
