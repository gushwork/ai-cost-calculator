import { loadModelAliasesConfig } from "./configLoader.js";

export function normalizeModelId(model: string): string {
  return model.trim().toLowerCase();
}

export function resolveCanonicalModelId(model: string): string {
  const aliases = loadModelAliasesConfig().normalized;
  const normalized = normalizeModelId(model);
  return aliases[normalized] ?? normalized;
}
