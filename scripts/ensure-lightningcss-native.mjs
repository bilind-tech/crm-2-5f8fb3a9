import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import os from "node:os";

const require = createRequire(import.meta.url);

const isLinuxArm64 = process.platform === "linux" && os.arch() === "arm64";

if (!isLinuxArm64) {
  process.exit(0);
}

const nativePackageName = "lightningcss-linux-arm64-gnu";

try {
  require.resolve(nativePackageName);
  process.exit(0);
} catch {
  // Continue below and install the missing native package.
}

let lightningCssVersion;

try {
  lightningCssVersion = require("lightningcss/package.json").version;
} catch (error) {
  console.error("Konnte lightningcss-Version nicht ermitteln.");
  throw error;
}

console.log(
  `Installiere fehlendes LightningCSS ARM64-Binary: ${nativePackageName}@${lightningCssVersion}`,
);

execFileSync(
  "npm",
  ["install", "--no-save", "--no-audit", "--no-fund", `${nativePackageName}@${lightningCssVersion}`],
  { stdio: "inherit" },
);