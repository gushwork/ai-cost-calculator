import { getAliasMap } from "./aliasBuilder.js";

export function normalizeModelId(model: string): string {
  return model.trim().toLowerCase();
}

export function stripProviderPrefix(modelId: string): string {
  const idx = modelId.indexOf("/");
  return idx >= 0 ? modelId.slice(idx + 1) : modelId;
}

export async function resolveCanonicalModelId(model: string): Promise<string> {
  const aliases = await getAliasMap();
  const normalized = normalizeModelId(model);
  if (aliases[normalized]) return aliases[normalized];
  const bare = stripProviderPrefix(normalized);
  if (bare !== normalized && aliases[bare]) {
    return aliases[bare];
  }
  return normalized;
}
