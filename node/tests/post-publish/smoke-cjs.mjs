import { execSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

const workDir = mkdtempSync(path.join(tmpdir(), "ai-cost-calculator-cjs-"));
const bundlePath = path.join(workDir, "bundle.cjs");

execSync(
  `npx esbuild ai-cost-calculator --bundle --platform=node --format=cjs --outfile=${bundlePath}`,
  { cwd: workDir, stdio: "inherit" },
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
