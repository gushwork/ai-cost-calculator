import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ProviderPricingMappingsConfig,
  ResponseMappingsConfig,
} from "../types.js";

function resolveConfigsDir(): string {
  if (process.env.LLMCOST_CONFIGS_DIR) {
    return process.env.LLMCOST_CONFIGS_DIR;
  }

  const fromCwdRepo = path.resolve(process.cwd(), "../configs");
  const fromCwdLocal = path.resolve(process.cwd(), "configs");
  const fromModule = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../../../configs",
  );

  const candidates = [fromCwdRepo, fromCwdLocal, fromModule];
  const existing = candidates.find((candidate) => existsSync(candidate));
  if (existing) {
    return existing;
  }

  return fromCwdRepo;
}

function readJsonFile<T>(fileName: string): T {
  const raw = readFileSync(path.join(resolveConfigsDir(), fileName), "utf-8");
  return JSON.parse(raw) as T;
}

export function loadResponseMappingsConfig(): ResponseMappingsConfig {
  return readJsonFile<ResponseMappingsConfig>("response-mappings.json");
}

export function loadProviderPricingMappingsConfig(): ProviderPricingMappingsConfig {
  return readJsonFile<ProviderPricingMappingsConfig>(
    "provider-pricing-mappings.json",
  );
}
