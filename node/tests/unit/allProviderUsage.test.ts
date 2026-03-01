import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "bun:test";

import { extractTokenUsage } from "../../src/data/responseTransformer.js";

process.env.LLMCOST_CONFIGS_DIR = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../..",
  "configs",
);

describe("extractTokenUsage provider coverage", () => {
  it("extracts usage for all configured provider mappings", () => {
    const cases: Array<{
      provider: string;
      response: unknown;
      expected: { inputTokens: number; outputTokens: number; totalTokens: number; cacheReadTokens: number; cacheCreationTokens: number };
    }> = [
      {
        provider: "openai",
        response: { usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 } },
        expected: { inputTokens: 10, outputTokens: 5, totalTokens: 15, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        provider: "openai_responses",
        response: { usage: { input_tokens: 20, output_tokens: 8, total_tokens: 28 } },
        expected: { inputTokens: 20, outputTokens: 8, totalTokens: 28, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        provider: "openai_chat_completions",
        response: { usage: { prompt_tokens: 11, completion_tokens: 9, total_tokens: 20 } },
        expected: { inputTokens: 11, outputTokens: 9, totalTokens: 20, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        provider: "openai_completions",
        response: { usage: { prompt_tokens: 7, completion_tokens: 3, total_tokens: 10 } },
        expected: { inputTokens: 7, outputTokens: 3, totalTokens: 10, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        provider: "openrouter",
        response: { usage: { prompt_tokens: 12, completion_tokens: 6, total_tokens: 18 } },
        expected: { inputTokens: 12, outputTokens: 6, totalTokens: 18, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        provider: "anthropic",
        response: { usage: { input_tokens: 30, output_tokens: 9 } },
        expected: { inputTokens: 30, outputTokens: 9, totalTokens: 39, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        provider: "google",
        response: {
          usageMetadata: {
            promptTokenCount: 13,
            candidatesTokenCount: 4,
            totalTokenCount: 17,
          },
        },
        expected: { inputTokens: 13, outputTokens: 4, totalTokens: 17, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        provider: "meta",
        response: { usage: { prompt_tokens: 14, completion_tokens: 6, total_tokens: 20 } },
        expected: { inputTokens: 14, outputTokens: 6, totalTokens: 20, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        provider: "mistral",
        response: { usage: { prompt_tokens: 21, completion_tokens: 5, total_tokens: 26 } },
        expected: { inputTokens: 21, outputTokens: 5, totalTokens: 26, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        provider: "cohere",
        response: { meta: { billed_units: { input_tokens: 16, output_tokens: 7 } } },
        expected: { inputTokens: 16, outputTokens: 7, totalTokens: 23, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        provider: "xai",
        response: { usage: { prompt_tokens: 22, completion_tokens: 11, total_tokens: 33 } },
        expected: { inputTokens: 22, outputTokens: 11, totalTokens: 33, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        provider: "deepseek",
        response: { usage: { prompt_tokens: 15, completion_tokens: 10, total_tokens: 25 } },
        expected: { inputTokens: 15, outputTokens: 10, totalTokens: 25, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        provider: "qwen",
        response: { usage: { prompt_tokens: 18, completion_tokens: 2, total_tokens: 20 } },
        expected: { inputTokens: 18, outputTokens: 2, totalTokens: 20, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
      {
        provider: "unknown-provider",
        response: { usage: { prompt_tokens: 9, completion_tokens: 1, total_tokens: 10 } },
        expected: { inputTokens: 9, outputTokens: 1, totalTokens: 10, cacheReadTokens: 0, cacheCreationTokens: 0 },
      },
    ];

    for (const testCase of cases) {
      const actual = extractTokenUsage(testCase.response, testCase.provider);
      expect(actual).toEqual(testCase.expected);
    }
  });
});
