import { readFileSync } from "node:fs";
import path from "node:path";

import type { ResponseMappingsConfig } from "../types.js";
import bundledMappings from "./response-mappings.json" with { type: "json" };

function loadFromEnvDir(): ResponseMappingsConfig {
  const configsDir = process.env.LLMCOST_CONFIGS_DIR;
  if (!configsDir) {
    throw new Error("LLMCOST_CONFIGS_DIR is not set");
  }
  const raw = readFileSync(path.join(configsDir, "response-mappings.json"), "utf-8");
  return JSON.parse(raw) as ResponseMappingsConfig;
}

let _responseMappingsCache: ResponseMappingsConfig | null = null;
export function loadResponseMappingsConfig(): ResponseMappingsConfig {
  if (!_responseMappingsCache) {
    _responseMappingsCache = process.env.LLMCOST_CONFIGS_DIR
      ? loadFromEnvDir()
      : (bundledMappings as ResponseMappingsConfig);
  }
  return _responseMappingsCache;
}
