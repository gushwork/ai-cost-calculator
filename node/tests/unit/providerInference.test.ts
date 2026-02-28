import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { afterEach, describe, expect, it, vi } from "vitest";

import {
  extractResponseMetadata,
  inferProviderFromModel,
} from "../../src/data/responseTransformer.js";
import { ProviderInferenceError } from "../../src/errors.js";
import { clearBerriCache } from "../../src/providers/berriClient.js";

function loadDotEnv(dotEnvPath: string): Record<string, string> {
  if (!existsSync(dotEnvPath)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(dotEnvPath, "utf-8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    out[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  }
  return out;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const envMap = loadDotEnv(path.join(repoRoot, ".env"));
for (const [k, v] of Object.entries(envMap)) {
  if (!process.env[k]) process.env[k] = v;
}

const liveEnabled = process.env.LLMCOST_E2E_LIVE === "true";

function buildBerriProviderPayload(): Record<string, Record<string, unknown>> {
  return {
    "openai/gpt-4o-mini": {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
      litellm_provider: "openai",
    },
    "openai/gpt-4o": {
      input_cost_per_token: 0.000002,
      output_cost_per_token: 0.000004,
      litellm_provider: "openai",
    },
    "anthropic/claude-3-5-sonnet": {
      input_cost_per_token: 0.000003,
      output_cost_per_token: 0.000006,
      litellm_provider: "anthropic",
    },
    "google/gemini-1.5-pro": {
      input_cost_per_token: 0.0000015,
      output_cost_per_token: 0.000003,
      litellm_provider: "google",
    },
    "meta-llama/llama-3.1-70b-instruct": {
      input_cost_per_token: 0.0000005,
      output_cost_per_token: 0.000001,
      litellm_provider: "meta",
    },
    "mistralai/mistral-large": {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
      litellm_provider: "mistral",
    },
    "cohere/command-r-plus": {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
      litellm_provider: "cohere",
    },
    "xai/grok-2": {
      input_cost_per_token: 0.000001,
      output_cost_per_token: 0.000002,
      litellm_provider: "xai",
    },
    "deepseek/deepseek-chat": {
      input_cost_per_token: 0.0000005,
      output_cost_per_token: 0.000001,
      litellm_provider: "deepseek",
    },
    "qwen/qwen-2.5-72b-instruct": {
      input_cost_per_token: 0.0000004,
      output_cost_per_token: 0.0000008,
      litellm_provider: "qwen",
    },
  };
}

describe("provider inference coverage", () => {
  afterEach(() => {
    clearBerriCache();
    vi.restoreAllMocks();
  });

  it("infers providers for canonical and aliased models", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(buildBerriProviderPayload()), { status: 200 }),
    );

    const cases: Array<{ model: string; provider: string }> = [
      { model: "openai/gpt-4o-mini", provider: "openai" },
      { model: "openrouter/openai/gpt-4o-mini", provider: "openai" },
      { model: "gpt-4o-mini-2024-07-18", provider: "openai" },
      { model: "anthropic/claude-3-5-sonnet", provider: "anthropic" },
      { model: "claude-3-5-sonnet-20241022", provider: "anthropic" },
      { model: "google/gemini-1.5-pro", provider: "google" },
      { model: "gemini-1.5-pro-latest", provider: "google" },
      { model: "meta/llama-3.1-70b-instruct", provider: "meta" },
      { model: "mistral/mistral-large", provider: "mistral" },
      { model: "cohere/command-r-plus", provider: "cohere" },
      { model: "xai/grok-2", provider: "xai" },
      { model: "deepseek/deepseek-chat", provider: "deepseek" },
      { model: "qwen/qwen-2.5-72b-instruct", provider: "qwen" },
    ];

    for (const testCase of cases) {
      await expect(inferProviderFromModel(testCase.model)).resolves.toBe(
        testCase.provider,
      );
    }
  });

  it("extracts response metadata across multiple model families", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(buildBerriProviderPayload()), { status: 200 }),
    );

    const metadata = await extractResponseMetadata({
      model: "openrouter/anthropic/claude-3-5-sonnet",
      usage: { input_tokens: 10, output_tokens: 5 },
    });

    expect(metadata).toEqual({
      model: "openrouter/anthropic/claude-3-5-sonnet",
      provider: "anthropic",
    });
  });

  it("throws for models with no provider mapping", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify(buildBerriProviderPayload()), { status: 200 }),
    );

    await expect(inferProviderFromModel("custom/no-map-model")).rejects.toBeInstanceOf(
      ProviderInferenceError,
    );
  });
});

describe("provider inference live", () => {
  afterEach(() => {
    clearBerriCache();
  });

  // These model IDs all exist in real Berri data. Because berriClient writes both
  // normalized and canonical keys, and OpenRouter aliases share canonicals with native
  // entries, exact provider values depend on JSON insertion order in Berri.
  // We therefore only assert that a non-empty provider string is returned.
  const knownModels = [
    "gpt-4o-mini",
    "gpt-4o",
    "claude-3-5-sonnet-20241022",
    "deepseek/deepseek-chat",
    "deepseek-chat",
    "openai/gpt-4o-mini",
    "openrouter/openai/gpt-4o-mini",
  ];

  it.skipIf(!liveEnabled)(
    "resolves known models to a non-empty provider string from real Berri data",
    async () => {
      for (const model of knownModels) {
        const provider = await inferProviderFromModel(model);
        expect(typeof provider, `provider for "${model}"`).toBe("string");
        expect(provider.length, `provider for "${model}"`).toBeGreaterThan(0);
        clearBerriCache();
      }
    },
  );

  it.skipIf(!liveEnabled)(
    "extracts model and a non-empty provider from an OpenAI-format response using live Berri data",
    async () => {
      const fakeResponse = {
        model: "claude-3-5-sonnet-20241022",
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
        choices: [{ message: { role: "assistant", content: "ok" } }],
      };

      const metadata = await extractResponseMetadata(fakeResponse);

      expect(metadata.model).toBe("claude-3-5-sonnet-20241022");
      expect(typeof metadata.provider).toBe("string");
      expect(metadata.provider.length).toBeGreaterThan(0);
    },
  );

  it.skipIf(!liveEnabled)(
    "throws ProviderInferenceError for a completely unknown model against live Berri data",
    async () => {
      await expect(
        inferProviderFromModel("completely-unknown-model-xyz-that-does-not-exist"),
      ).rejects.toBeInstanceOf(ProviderInferenceError);
    },
  );
});
