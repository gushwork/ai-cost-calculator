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

  if (input !== null || output !== null) {
    const inputTokens = input ?? 0;
    const outputTokens = output ?? 0;
    return {
      inputTokens,
      outputTokens,
      totalTokens: total ?? inputTokens + outputTokens,
    };
  }

  return {
    inputTokens: total ?? 0,
    outputTokens: 0,
    totalTokens: total ?? 0,
  };
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
): Promise<{ model: string; provider: string }> {
  const model = extractResponseModel(response);
  const provider = await inferProviderFromModel(model);
  return { model, provider };
}
