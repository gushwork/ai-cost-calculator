import { readFileSync } from "node:fs";
import path from "node:path";

import type { ResponseMappingsConfig } from "../types.js";
import bundledResponseMappings from "./response-mappings.json" with { type: "json" };

function readJsonFile<T>(dir: string, fileName: string): T {
  const raw = readFileSync(path.join(dir, fileName), "utf-8");
  return JSON.parse(raw) as T;
}

let _responseMappingsCache: ResponseMappingsConfig | null = null;
export function loadResponseMappingsConfig(): ResponseMappingsConfig {
  if (!_responseMappingsCache) {
    const overrideDir = process.env.LLMCOST_CONFIGS_DIR;
    if (overrideDir) {
      _responseMappingsCache = readJsonFile<ResponseMappingsConfig>(
        overrideDir,
        "response-mappings.json",
      );
    } else {
      _responseMappingsCache = bundledResponseMappings as ResponseMappingsConfig;
    }
  }
  return _responseMappingsCache;
}
