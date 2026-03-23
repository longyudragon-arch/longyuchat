import { spawn } from "node:child_process";

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

const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const npmArgs = ["run", "dev"];

if (args.length > 0) {
  npmArgs.push("--", ...args);
}

console.log("[dev:local] Starting Next.js dev server...");

const child = spawn(npmCommand, npmArgs, {
  env,
  stdio: "inherit",
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});
