import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, mock, spyOn } from "bun:test";

import {
  extractTokenUsage,
  getInputIncludesCacheRead,
} from "../../src/data/responseTransformer.js";
import { computeCost } from "../../src/calculator/computeCost.js";
import { BerrilmBasedCalculator } from "../../src/calculator/BerrilmBasedCalculator.js";
import { OpenRouterBasedCalculator } from "../../src/calculator/OpenRouterBasedCalculator.js";
import { clearBerriCache } from "../../src/providers/berriClient.js";
import { clearOpenRouterCache } from "../../src/providers/openrouterClient.js";
import { clearAliasCache } from "../../src/data/aliasBuilder.js";
import type { NormalizedPricingModel, TokenUsage } from "../../src/types.js";

process.env.LLMCOST_CONFIGS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
  "configs",
);

describe("cache token extraction", () => {
  it("extracts OpenAI cached_tokens from prompt_tokens_details", () => {
    const usage = extractTokenUsage(
      {
        usage: {
          prompt_tokens: 2006,
          completion_tokens: 300,
          total_tokens: 2306,
          prompt_tokens_details: { cached_tokens: 1920 },
        },
      },
      "openai",
    );
    expect(usage.inputTokens).toBe(2006);
    expect(usage.outputTokens).toBe(300);
    expect(usage.cacheReadTokens).toBe(1920);
    expect(usage.cacheCreationTokens).toBe(0);
  });

  it("extracts Anthropic cache_read and cache_creation tokens", () => {
    const usage = extractTokenUsage(
      {
        usage: {
          input_tokens: 50,
          output_tokens: 503,
          cache_read_input_tokens: 100000,
          cache_creation_input_tokens: 248,
        },
      },
      "anthropic",
    );
    expect(usage.inputTokens).toBe(50);
    expect(usage.outputTokens).toBe(503);
    expect(usage.cacheReadTokens).toBe(100000);
    expect(usage.cacheCreationTokens).toBe(248);
  });

  it("extracts Google cachedContentTokenCount", () => {
    const usage = extractTokenUsage(
      {
        usageMetadata: {
          promptTokenCount: 50000,
          candidatesTokenCount: 200,
          totalTokenCount: 50200,
          cachedContentTokenCount: 48000,
        },
      },
      "google",
    );
    expect(usage.inputTokens).toBe(50000);
    expect(usage.cacheReadTokens).toBe(48000);
    expect(usage.cacheCreationTokens).toBe(0);
  });

  it("extracts DeepSeek prompt_cache_hit_tokens", () => {
    const usage = extractTokenUsage(
      {
        usage: {
          prompt_tokens: 100,
          completion_tokens: 50,
          total_tokens: 150,
          prompt_cache_hit_tokens: 80,
          prompt_cache_miss_tokens: 20,
        },
      },
      "deepseek",
    );
    expect(usage.inputTokens).toBe(100);
    expect(usage.cacheReadTokens).toBe(80);
  });

  it("extracts OpenRouter cached_tokens and cache_write_tokens", () => {
    const usage = extractTokenUsage(
      {
        usage: {
          prompt_tokens: 10339,
          completion_tokens: 60,
          total_tokens: 10399,
          prompt_tokens_details: {
            cached_tokens: 10318,
            cache_write_tokens: 21,
          },
        },
      },
      "openrouter",
    );
    expect(usage.inputTokens).toBe(10339);
    expect(usage.cacheReadTokens).toBe(10318);
    expect(usage.cacheCreationTokens).toBe(21);
  });

  it("extracts xAI cached_tokens", () => {
    const usage = extractTokenUsage(
      {
        usage: {
          prompt_tokens: 199,
          completion_tokens: 1,
          total_tokens: 200,
          prompt_tokens_details: { cached_tokens: 163 },
        },
      },
      "xai",
    );
    expect(usage.inputTokens).toBe(199);
    expect(usage.cacheReadTokens).toBe(163);
  });

  it("defaults cache tokens to 0 when not present", () => {
    const usage = extractTokenUsage(
      { usage: { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 } },
      "openai",
    );
    expect(usage.cacheReadTokens).toBe(0);
    expect(usage.cacheCreationTokens).toBe(0);
  });
});

describe("getInputIncludesCacheRead", () => {
  it("returns true for openai", () => {
    expect(getInputIncludesCacheRead("openai")).toBe(true);
  });

  it("returns false for anthropic", () => {
    expect(getInputIncludesCacheRead("anthropic")).toBe(false);
  });

  it("returns true for unknown providers (default)", () => {
    expect(getInputIncludesCacheRead("some-unknown-provider")).toBe(true);
  });
});

describe("computeCost with cache tokens", () => {
  const pricing: NormalizedPricingModel = {
    modelId: "test-model",
    inputCostPer1M: 10,
    outputCostPer1M: 30,
    cacheReadCostPer1M: 1,
    cacheCreationCostPer1M: 12.5,
    currency: "USD",
  };

  it("computes correct cost with cache read (inputIncludesCacheRead=true)", () => {
    const usage: TokenUsage = {
      inputTokens: 2000,
      outputTokens: 500,
      totalTokens: 2500,
      cacheReadTokens: 1500,
      cacheCreationTokens: 0,
    };
    const cost = computeCost(usage, pricing, true);
    // effectiveInput = 2000 - 1500 = 500
    // cost = (500/1M)*10 + (1500/1M)*1 + (0/1M)*12.5 + (500/1M)*30
    //       = 0.005 + 0.0015 + 0 + 0.015 = 0.0215
    expect(cost).toBeCloseTo(0.0215, 10);
  });

  it("computes correct cost with cache read (inputIncludesCacheRead=false, Anthropic style)", () => {
    const usage: TokenUsage = {
      inputTokens: 50,
      outputTokens: 500,
      totalTokens: 550,
      cacheReadTokens: 100000,
      cacheCreationTokens: 248,
    };
    const cost = computeCost(usage, pricing, false);
    // effectiveInput = 50 (not subtracted)
    // cost = (50/1M)*10 + (100000/1M)*1 + (248/1M)*12.5 + (500/1M)*30
    //       = 0.0005 + 0.1 + 0.0031 + 0.015 = 0.1186
    expect(cost).toBeCloseTo(0.1186, 10);
  });

  it("falls back to inputCostPer1M when cache pricing is not available", () => {
    const noCachePricing: NormalizedPricingModel = {
      modelId: "test-model",
      inputCostPer1M: 10,
      outputCostPer1M: 30,
      currency: "USD",
    };
    const usage: TokenUsage = {
      inputTokens: 2000,
      outputTokens: 500,
      totalTokens: 2500,
      cacheReadTokens: 1500,
      cacheCreationTokens: 0,
    };
    const cost = computeCost(usage, noCachePricing, true);
    // effectiveInput = 500, cacheRead at inputRate
    // cost = (500/1M)*10 + (1500/1M)*10 + (500/1M)*30 = 0.005 + 0.015 + 0.015 = 0.035
    expect(cost).toBeCloseTo(0.035, 10);
  });

  it("produces same result as old formula when no cache tokens", () => {
    const usage: TokenUsage = {
      inputTokens: 1000,
      outputTokens: 500,
      totalTokens: 1500,
    };
    const cost = computeCost(usage, pricing, true);
    const oldCost =
      (1000 / 1_000_000) * pricing.inputCostPer1M +
      (500 / 1_000_000) * pricing.outputCostPer1M;
    expect(cost).toBeCloseTo(oldCost, 10);
  });
});

describe("calculator with cache pricing from Berri", () => {
  afterEach(() => {
    clearBerriCache();
    clearOpenRouterCache();
    clearAliasCache();
    mock.restore();
  });

  it("calculates cost accounting for cache tokens", async () => {
    spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          "gpt-4o-mini": {
            input_cost_per_token: 0.00000015,
            output_cost_per_token: 0.0000006,
            cache_read_input_token_cost: 0.000000075,
            litellm_provider: "openai",
          },
        }),
        { status: 200 },
      ),
    );

    const result = await BerrilmBasedCalculator.getCost({
      model: "gpt-4o-mini",
      usage: {
        prompt_tokens: 2000,
        completion_tokens: 500,
        total_tokens: 2500,
        prompt_tokens_details: { cached_tokens: 1500 },
      },
    });

    // effectiveInput = 2000 - 1500 = 500
    // inputCost = (500/1M) * 0.15 = 0.000075
    // cacheReadCost = (1500/1M) * 0.075 = 0.0001125
    // outputCost = (500/1M) * 0.6 = 0.0003
    // total = 0.0004875
    expect(result.cost).toBeCloseTo(0.0004875, 10);
    expect(result.currency).toBe("USD");
  });

  it("calculates cost without cache tokens (backward compat)", async () => {
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

    const result = await BerrilmBasedCalculator.getCost({
      model: "gpt-4o-mini",
      usage: {
        prompt_tokens: 1000,
        completion_tokens: 500,
        total_tokens: 1500,
      },
    });

    expect(result).toEqual({ currency: "USD", cost: 0.00045 });
  });
});

describe("calculator with cache pricing from OpenRouter", () => {
  afterEach(() => {
    clearBerriCache();
    clearOpenRouterCache();
    clearAliasCache();
    mock.restore();
  });

  it("parses cache pricing from OpenRouter and computes cost", async () => {
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
                pricing: {
                  prompt: "0.00000015",
                  completion: "0.0000006",
                  input_cache_read: "0.000000075",
                  input_cache_write: "0.00000015",
                },
              },
            ],
          }),
          { status: 200 },
        ),
      );

    const result = await OpenRouterBasedCalculator.getCost({
      model: "openai/gpt-4o-mini",
      usage: {
        prompt_tokens: 2000,
        completion_tokens: 500,
        total_tokens: 2500,
        prompt_tokens_details: { cached_tokens: 1500 },
      },
    });

    // effectiveInput = 500, cacheRead = 1500
    // cost = (500/1M)*0.15 + (1500/1M)*0.075 + (500/1M)*0.6
    //       = 0.000075 + 0.0001125 + 0.0003 = 0.0004875
    expect(result.cost).toBeCloseTo(0.0004875, 10);
  });
});
