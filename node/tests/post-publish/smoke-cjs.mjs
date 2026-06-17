import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import path from "node:path";

// Keep temp artifacts under the smoke-test dir so esbuild can resolve
// ai-cost-calculator and esbuild from the npm install in process.cwd().
const workDir = mkdtempSync(
  path.join(process.cwd(), "ai-cost-calculator-cjs-"),
);
const bundlePath = path.join(workDir, "bundle.cjs");

execSync(
  `npx esbuild ai-cost-calculator --bundle --platform=node --format=cjs --outfile=${bundlePath}`,
  { cwd: process.cwd(), stdio: "inherit" },
);

writeFileSync(
  path.join(workDir, "run.cjs"),
  `
const { BestEffortCalculator } = require(${JSON.stringify(bundlePath)});
if (typeof BestEffortCalculator.getCost !== "function") {
  throw new Error("BestEffortCalculator.getCost missing from CJS bundle");
}
console.log("Post-publish CJS bundle smoke test passed");
`,
);

execSync("node run.cjs", { cwd: workDir, stdio: "inherit" });
