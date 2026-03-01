import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import type {
  ProviderPricingMappingsConfig,
  ResponseMappingsConfig,
} from "../types.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BUNDLED_DIR = __dirname;
const REPO_CONFIGS_DIR = path.resolve(__dirname, "../../../configs");

function resolveConfigsDir(): string {
  if (process.env.LLMCOST_CONFIGS_DIR) {
    return process.env.LLMCOST_CONFIGS_DIR;
  }
  if (existsSync(path.join(BUNDLED_DIR, "response-mappings.json"))) {
    return BUNDLED_DIR;
  }
  if (existsSync(REPO_CONFIGS_DIR)) {
    return REPO_CONFIGS_DIR;
  }
  return BUNDLED_DIR;
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
