import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const LOCAL_BYPASS_HOSTS = ["localhost", "127.0.0.1", "::1"];
const args = process.argv.slice(2);

function buildNoProxyValue(...values) {
  const merged = [];

  for (const value of values) {
    for (const entry of String(value ?? "").split(",")) {
      const normalized = entry.trim();

      if (!normalized) {
        continue;
      }

      if (!merged.includes(normalized)) {
        merged.push(normalized);
      }
    }
  }

  for (const host of LOCAL_BYPASS_HOSTS) {
    if (!merged.includes(host)) {
      merged.push(host);
    }
  }

  return merged.join(",");
}

const noProxyValue = buildNoProxyValue(process.env.NO_PROXY, process.env.no_proxy);
const env = {
  ...process.env,
  NO_PROXY: noProxyValue,
  no_proxy: noProxyValue,
};

console.log(`[dev:local] NO_PROXY=${noProxyValue}`);

if (args.includes("--print-env")) {
  process.exit(0);
}

const require = createRequire(import.meta.url);
const nextBin = require.resolve("next/dist/bin/next");

console.log("[dev:local] Starting Next.js dev server...");

const child = spawn(process.execPath, [nextBin, "dev", "--hostname", "127.0.0.1", ...args], {
  env,
  stdio: "inherit",
});

child.on("error", (error) => {
  console.error("Could not start the local server:", error.message);
  process.exitCode = 1;
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
