import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractResponseMetadata,
  extractTokenUsage,
} from "../../src/data/responseTransformer.js";
import { clearBerriCache } from "../../src/providers/berriClient.js";

process.env.LLMCOST_CONFIGS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
  "configs",
);

describe("responseTransformer", () => {
  afterEach(() => {
    clearBerriCache();
    vi.restoreAllMocks();
  });

  it("extracts prompt and completion tokens", () => {
    const usage = extractTokenUsage(
      {
        usage: {
          prompt_tokens: 1000,
          completion_tokens: 250,
          total_tokens: 1250,
        },
      },
      "openai",
    );

    expect(usage).toEqual({
      inputTokens: 1000,
      outputTokens: 250,
      totalTokens: 1250,
    });
  });

  it("falls back to total tokens only", () => {
    const usage = extractTokenUsage(
      {
        usage: {
          total_tokens: 777,
        },
      },
      "openai",
    );

    expect(usage).toEqual({
      inputTokens: 777,
      outputTokens: 0,
      totalTokens: 777,
    });
  });

  it("extracts OpenAI Responses API usage fields", () => {
    const usage = extractTokenUsage(
      {
        usage: {
          input_tokens: 321,
          output_tokens: 123,
          total_tokens: 444,
        },
      },
      "openai_responses",
    );

    expect(usage).toEqual({
      inputTokens: 321,
      outputTokens: 123,
      totalTokens: 444,
    });
  });

  it("extracts OpenAI legacy completions usage fields", () => {
    const usage = extractTokenUsage(
      {
        usage: {
          prompt_tokens: 111,
          completion_tokens: 22,
          total_tokens: 133,
        },
      },
      "openai_completions",
    );

    expect(usage).toEqual({
      inputTokens: 111,
      outputTokens: 22,
      totalTokens: 133,
    });
  });

  it("extracts model and infers provider from Berri config", async () => {
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

    const metadata = await extractResponseMetadata({
      model: "openai/gpt-4o-mini",
      usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
    });

    expect(metadata).toEqual({
      model: "openai/gpt-4o-mini",
      provider: "openai",
    });
  });
});
