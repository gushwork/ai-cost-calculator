import { afterEach, beforeEach, describe, expect, it, mock, spyOn } from "bun:test";

import { BerrilmBasedCalculator } from "../../src/calculator/BerrilmBasedCalculator.js";
import { BestEffortCalculator } from "../../src/calculator/BestEffortCalculator.js";
import { OpenRouterBasedCalculator } from "../../src/calculator/OpenRouterBasedCalculator.js";
import { PortkeyBasedCalculator } from "../../src/calculator/PortkeyBasedCalculator.js";
import {
  ModelNotFoundError,
  ProviderInferenceError,
  UsageNotFoundError,
} from "../../src/errors.js";
import { clearBerriCache } from "../../src/providers/berriClient.js";
import { clearHeliconeCache } from "../../src/providers/heliconeClient.js";
import { clearOpenRouterCache } from "../../src/providers/openrouterClient.js";
import { clearPortkeyCache } from "../../src/providers/portkeyClient.js";

describe("multi-model calculators", () => {
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

  it("calculates Berri cost for anthropic model", async () => {
    spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "anthropic/claude-3-5-sonnet": {
            input_cost_per_token: 0.000001,
            output_cost_per_token: 0.000002,
            litellm_provider: "anthropic",
          },
        }),
        { status: 200 },
      ),
    );

    const result = await BerrilmBasedCalculator.getCost({
      model: "anthropic/claude-3-5-sonnet",
      usage: { input_tokens: 1000, output_tokens: 500 },
    });

    expect(result).toEqual({ currency: "USD", cost: 0.002 });
  });

  it("calculates OpenRouter cost for google model", async () => {
    spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            "google/gemini-1.5-pro": {
              input_cost_per_token: 0.0000005,
              output_cost_per_token: 0.000001,
              litellm_provider: "google",
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
                id: "google/gemini-1.5-pro",
                pricing: { prompt: "0.0000015", completion: "0.000003" },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const result = await OpenRouterBasedCalculator.getCost({
      model: "google/gemini-1.5-pro",
      usageMetadata: {
        promptTokenCount: 1000,
        candidatesTokenCount: 500,
        totalTokenCount: 1500,
      },
    });

    expect(result).toEqual({ currency: "USD", cost: 0.003 });
  });

  it("calculates Portkey cost with canonical alias fallback", async () => {
    spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            "deepseek/deepseek-chat": {
              input_cost_per_token: 0.0000005,
              output_cost_per_token: 0.000001,
              litellm_provider: "deepseek",
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
                      id: "deepseek-chat",
                      pricing: { inputCostPer1M: 10, outputCostPer1M: 20 },
                    },
                  ],
                },
              },
            },
          )}</script>`,
          { status: 200 },
        ),
      );

    const result = await PortkeyBasedCalculator.getCost({
      model: "deepseek/deepseek-chat",
      usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
    });

    expect(result).toEqual({ currency: "USD", cost: 0.02 });
  });

  it("falls back to Portkey when OpenRouter and Berri miss", async () => {
    spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            "xai/grok-2": { litellm_provider: "xai" },
          }),
          { status: 200 },
        ),
      )
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(
        new Response(
          `<!doctype html><script id="__NEXT_DATA__" type="application/json">${JSON.stringify(
            {
              props: {
                pageProps: {
                  models: [
                    {
                      id: "grok-2",
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

    const result = await BestEffortCalculator.getCost({
      model: "xai/grok-2",
      usage: { prompt_tokens: 1000, completion_tokens: 500, total_tokens: 1500 },
    });

    expect(result).toEqual({ currency: "USD", cost: 0.2 });
  });

  it("throws ModelNotFoundError when mapped provider exists but pricing entry is missing", async () => {
    spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "meta/llama-3.1-70b-instruct": {
            litellm_provider: "meta",
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      BerrilmBasedCalculator.getCost({
        model: "meta/llama-3.1-70b-instruct",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    ).rejects.toBeInstanceOf(ModelNotFoundError);
  });

  it("throws UsageNotFoundError for missing usage payload", async () => {
    spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "mistralai/mistral-large": {
            input_cost_per_token: 0.000001,
            output_cost_per_token: 0.000001,
            litellm_provider: "mistral",
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      BerrilmBasedCalculator.getCost({
        model: "mistralai/mistral-large",
      }),
    ).rejects.toBeInstanceOf(UsageNotFoundError);
  });

  it("throws ProviderInferenceError for unknown model", async () => {
    spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "openai/gpt-4o-mini": {
            input_cost_per_token: 0.000001,
            output_cost_per_token: 0.000002,
            litellm_provider: "openai",
          },
        }),
        { status: 200 },
      ),
    );

    await expect(
      BerrilmBasedCalculator.getCost({
        model: "unknown-provider/unknown-model",
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }),
    ).rejects.toBeInstanceOf(ProviderInferenceError);
  });
});
