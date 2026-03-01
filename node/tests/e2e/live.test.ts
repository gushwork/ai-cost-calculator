import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "bun:test";

import { BestEffortCalculator } from "../../src/calculator/BestEffortCalculator.js";

function loadDotEnv(dotEnvPath: string): Record<string, string> {
  if (!existsSync(dotEnvPath)) return {};
  const out: Record<string, string> = {};
  const lines = readFileSync(dotEnvPath, "utf-8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    const value = trimmed.slice(idx + 1).trim();
    out[key] = value;
  }
  return out;
}

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const envMap = loadDotEnv(path.join(repoRoot, ".env"));
for (const [k, v] of Object.entries(envMap)) {
  if (!process.env[k]) process.env[k] = v;
}

process.env.LLMCOST_CONFIGS_DIR = path.join(repoRoot, "configs");

const liveEnabled = process.env.LLMCOST_E2E_LIVE === "true";

type LiveInvocation = {
  response: unknown;
  source:
    | "openrouter"
    | "openai_responses"
    | "openai_chat_completions"
    | "openai_completions";
};

async function callOpenRouter(): Promise<LiveInvocation> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error("OPENROUTER_API_KEY not set");

  const model = process.env.LLMCOST_E2E_OPENROUTER_MODEL ?? "openai/gpt-4o-mini";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      ...(process.env.OPENROUTER_HTTP_REFERER
        ? { "HTTP-Referer": process.env.OPENROUTER_HTTP_REFERER }
        : {}),
      ...(process.env.OPENROUTER_X_TITLE
        ? { "X-Title": process.env.OPENROUTER_X_TITLE }
        : {}),
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with exactly: ok" }],
      max_tokens: 8,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenRouter request failed: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  return {
    response: json,
    source: "openrouter",
  };
}

async function callOpenAI(): Promise<LiveInvocation> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const model = process.env.LLMCOST_E2E_MODEL ?? "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with exactly: ok" }],
      max_tokens: 8,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI request failed: ${response.status}`);
  }

  const json = (await response.json()) as unknown;
  return {
    response: json,
    source: "openai_chat_completions",
  };
}

async function getLiveInvocation(): Promise<LiveInvocation> {
  if (process.env.OPENROUTER_API_KEY) {
    return callOpenRouter();
  }
  if (process.env.OPENAI_API_KEY) {
    return callOpenAI();
  }
  throw new Error("No live API key found. Set OPENROUTER_API_KEY or OPENAI_API_KEY.");
}

async function callOpenAIResponses(): Promise<LiveInvocation> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const model = process.env.LLMCOST_E2E_OPENAI_RESPONSES_MODEL ?? "gpt-4o-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: "Reply with exactly: ok",
      max_output_tokens: 8,
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI Responses request failed: ${response.status}`);
  }
  return {
    response: (await response.json()) as unknown,
    source: "openai_responses",
  };
}

async function callOpenAICompletions(): Promise<LiveInvocation> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY not set");

  const model = process.env.LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL;
  if (!model) {
    throw new Error("LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL not set");
  }

  const response = await fetch("https://api.openai.com/v1/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      prompt: "Reply with exactly: ok",
      max_tokens: 8,
      temperature: 0,
    }),
  });
  if (!response.ok) {
    throw new Error(`OpenAI Completions request failed: ${response.status}`);
  }
  return {
    response: (await response.json()) as unknown,
    source: "openai_completions",
  };
}

describe("node e2e live", () => {
  it.skipIf(!liveEnabled)(
    "calculates cost using OpenRouter when available, else native API",
    async () => {
      const invocation = await getLiveInvocation();
      const result = await BestEffortCalculator.getCost(invocation.response);

      expect(result.currency).toBe("USD");
      expect(result.cost).toBeGreaterThan(0);
      expect(
        invocation.source === "openrouter" ||
          invocation.source === "openai_chat_completions",
      ).toBe(true);
    },
  );

  it.skipIf(!liveEnabled || !process.env.OPENAI_API_KEY)(
    "calculates cost from OpenAI Responses API usage payload",
    async () => {
      const invocation = await callOpenAIResponses();
      const result = await BestEffortCalculator.getCost(invocation.response);
      expect(result.currency).toBe("USD");
      expect(result.cost).toBeGreaterThan(0);
    },
  );

  it.skipIf(!liveEnabled || !process.env.OPENAI_API_KEY)(
    "calculates cost from OpenAI Chat Completions API usage payload",
    async () => {
      const invocation = await callOpenAI();
      const result = await BestEffortCalculator.getCost(invocation.response);
      expect(result.currency).toBe("USD");
      expect(result.cost).toBeGreaterThan(0);
    },
  );

  it.skipIf(
    !liveEnabled || !process.env.OPENAI_API_KEY || !process.env.LLMCOST_E2E_OPENAI_COMPLETIONS_MODEL,
  )(
    "calculates cost from OpenAI legacy Completions API usage payload",
    async () => {
      const invocation = await callOpenAICompletions();
      const result = await BestEffortCalculator.getCost(invocation.response);
      expect(result.currency).toBe("USD");
      expect(result.cost).toBeGreaterThan(0);
    },
  );
});

const multiProviderModels: Array<{ provider: string; model: string; providerOverride?: string }> = [
  { provider: "openai", model: "openai/gpt-4o-mini" },
  { provider: "anthropic", model: "anthropic/claude-3.5-haiku" },
  { provider: "google", model: "google/gemini-2.0-flash-001" },
  { provider: "meta", model: "meta-llama/llama-3.1-8b-instruct" },
  { provider: "mistral", model: "mistralai/mistral-small-24b-instruct-2501" },
  { provider: "cohere", model: "cohere/command-r-08-2024" },
  { provider: "xai", model: "x-ai/grok-3-mini" },
  { provider: "deepseek", model: "deepseek/deepseek-chat-v3-0324" },
  { provider: "qwen", model: "qwen/qwen-2.5-7b-instruct", providerOverride: "openrouter" },
];

const canRunMultiProvider = liveEnabled && !!process.env.OPENROUTER_API_KEY;

async function callOpenRouterModel(model: string): Promise<unknown> {
  const apiKey = process.env.OPENROUTER_API_KEY!;
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [{ role: "user", content: "Reply with: ok" }],
      max_tokens: 5,
      temperature: 0,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OpenRouter ${model} failed (${response.status}): ${body}`);
  }

  return (await response.json()) as unknown;
}

describe("multi-provider live via OpenRouter", () => {
  for (const { provider, model, providerOverride } of multiProviderModels) {
    it.skipIf(!canRunMultiProvider)(
      `[${provider}] calculates cost for ${model}`,
      async () => {
        const response = await callOpenRouterModel(model);
        const options = providerOverride ? { provider: providerOverride } : undefined;
        const result = await BestEffortCalculator.getCost(response, options);

        expect(result.currency).toBe("USD");
        expect(typeof result.cost).toBe("number");
        expect(Number.isFinite(result.cost)).toBe(true);
        expect(result.cost).toBeGreaterThanOrEqual(0);
      },
      { timeout: 60_000 },
    );
  }
});
