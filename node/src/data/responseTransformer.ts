import { JSONPath } from "jsonpath-plus";

import { ModelInferenceError, ProviderInferenceError, UsageNotFoundError } from "../errors.js";
import type { TokenUsage } from "../types.js";
import { normalizeModelId, stripProviderPrefix } from "./modelResolver.js";
import { getBerriModelProviderMap } from "../providers/berriClient.js";
import { loadResponseMappingsConfig } from "./configLoader.js";

function getFirstNumericValue(response: unknown, paths: string[]): number | null {
  for (const path of paths) {
    const values = JSONPath({ path, json: response as object }) as unknown[];
    const first = values[0];
    if (typeof first === "number" && Number.isFinite(first)) {
      return first;
    }
    if (typeof first === "string") {
      const parsed = Number(first);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export function extractTokenUsage(response: unknown, provider: string): TokenUsage {
  const mappings = loadResponseMappingsConfig();
  const mapping = mappings[provider] ?? mappings.default;

  if (!mapping) {
    throw new UsageNotFoundError(
      `No response mapping found for provider "${provider}" and no default mapping exists.`,
    );
  }

  const input = getFirstNumericValue(response, mapping.inputTokensPaths);
  const output = getFirstNumericValue(response, mapping.outputTokensPaths);
  const total = getFirstNumericValue(response, mapping.totalTokensPaths);

  if (input === null && output === null && total === null) {
    throw new UsageNotFoundError(
      `Could not extract token usage for provider "${provider}".`,
    );
  }

  const cacheRead = mapping.cacheReadTokensPaths?.length
    ? getFirstNumericValue(response, mapping.cacheReadTokensPaths) ?? 0
    : 0;
  const cacheCreation = mapping.cacheCreationTokensPaths?.length
    ? getFirstNumericValue(response, mapping.cacheCreationTokensPaths) ?? 0
    : 0;

  if (input !== null || output !== null) {
    const inputTokens = input ?? 0;
    const outputTokens = output ?? 0;
    return {
      inputTokens,
      outputTokens,
      totalTokens: total ?? inputTokens + outputTokens,
      cacheReadTokens: cacheRead,
      cacheCreationTokens: cacheCreation,
    };
  }

  return {
    inputTokens: total ?? 0,
    outputTokens: 0,
    totalTokens: total ?? 0,
    cacheReadTokens: cacheRead,
    cacheCreationTokens: cacheCreation,
  };
}

export function detectToolCalls(response: unknown): boolean {
  if (response == null || typeof response !== "object") return false;
  const obj = response as Record<string, unknown>;

  // OpenAI chat completions: choices[].message.tool_calls
  const choices = obj.choices;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const message = (choice as Record<string, unknown>)?.message;
      if (message && typeof message === "object") {
        const toolCalls = (message as Record<string, unknown>).tool_calls;
        if (Array.isArray(toolCalls) && toolCalls.length > 0) return true;
      }
    }
  }

  // Anthropic: content[].type === "tool_use"
  const content = obj.content;
  if (Array.isArray(content)) {
    for (const block of content) {
      if ((block as Record<string, unknown>)?.type === "tool_use") return true;
    }
  }

  // OpenAI Responses API: output[].type === "function_call"
  const output = obj.output;
  if (Array.isArray(output)) {
    for (const item of output) {
      if ((item as Record<string, unknown>)?.type === "function_call") return true;
    }
  }

  // Google Gemini: candidates[].content.parts[].functionCall
  const candidates = obj.candidates;
  if (Array.isArray(candidates)) {
    for (const candidate of candidates) {
      const parts = (candidate as Record<string, unknown>)?.content;
      if (parts && typeof parts === "object") {
        const partsList = (parts as Record<string, unknown>).parts;
        if (Array.isArray(partsList)) {
          for (const part of partsList) {
            if ((part as Record<string, unknown>)?.functionCall) return true;
          }
        }
      }
    }
  }

  return false;
}

export function getInputIncludesCacheRead(provider: string): boolean {
  const mappings = loadResponseMappingsConfig();
  const mapping = mappings[provider] ?? mappings.default;
  return mapping?.inputIncludesCacheRead !== false;
}

function getFirstStringValue(response: unknown, paths: string[]): string | null {
  for (const path of paths) {
    const values = JSONPath({ path, json: response as object }) as unknown[];
    const first = values[0];
    if (typeof first === "string" && first.trim().length > 0) {
      return first.trim();
    }
  }
  return null;
}

export function extractResponseModel(response: unknown): string {
  const model = getFirstStringValue(response, ["$.model", "$.response.model", "$.data.model"]);
  if (!model) {
    throw new ModelInferenceError("Could not infer model from response.");
  }
  return model;
}

export async function inferProviderFromModel(model: string): Promise<string> {
  const providerMap = await getBerriModelProviderMap();
  const normalizedModel = normalizeModelId(model);

  let provider = providerMap.get(normalizedModel);
  if (provider) return provider;

  const stripped = stripProviderPrefix(normalizedModel);
  if (stripped !== normalizedModel) {
    provider = providerMap.get(stripped);
    if (provider) return provider;

    const doubleStripped = stripProviderPrefix(stripped);
    if (doubleStripped !== stripped) {
      provider = providerMap.get(doubleStripped);
      if (provider) return provider;
    }
  }

  let bestMatch: { key: string; provider: string } | null = null;
  for (const [key, value] of providerMap) {
    if (
      normalizedModel.startsWith(key) &&
      normalizedModel.length > key.length
    ) {
      const sep = normalizedModel[key.length];
      if (sep === "-" || sep === ":" || sep === ".") {
        if (!bestMatch || key.length > bestMatch.key.length) {
          bestMatch = { key, provider: value };
        }
      }
    }
  }
  if (bestMatch) return bestMatch.provider;

  throw new ProviderInferenceError(
    `Could not infer provider from model "${model}" using Berri config mapping.`,
  );
}

export async function extractResponseMetadata(
  response: unknown,
  overrides?: { model?: string; provider?: string },
): Promise<{ model: string; provider: string }> {
  const model = overrides?.model ?? extractResponseModel(response);
  const provider = overrides?.provider ?? await inferProviderFromModel(model);
  return { model, provider };
}
