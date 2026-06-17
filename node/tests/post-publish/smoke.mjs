import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

import * as esbuild from "esbuild";
import { BestEffortCalculator } from "ai-cost-calculator";

const response = {
  model: "gpt-4o-mini",
  usage: {
    prompt_tokens: 1000,
    completion_tokens: 500,
    total_tokens: 1500,
  },
};

async function assertCost(calculator, label) {
  const result = await calculator.getCost(response);

  if (result.currency !== "USD") {
    throw new Error(`${label}: expected currency "USD", got "${result.currency}"`);
  }
  if (typeof result.cost !== "number" || result.cost <= 0) {
    throw new Error(`${label}: expected positive cost, got ${result.cost}`);
  }

  console.log(`${label} passed:`, result);
}

await assertCost(BestEffortCalculator, "ESM smoke test");

const bundleDir = mkdtempSync(path.join(tmpdir(), "ai-cost-calc-smoke-"));
const bundlePath = path.join(bundleDir, "bundle.cjs");

try {
  await esbuild.build({
    entryPoints: ["ai-cost-calculator"],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: bundlePath,
  });

  const require = createRequire(import.meta.url);
  const bundled = require(bundlePath);
  await assertCost(bundled.BestEffortCalculator, "CJS bundle smoke test");
} finally {
  rmSync(bundleDir, { recursive: true, force: true });
}
