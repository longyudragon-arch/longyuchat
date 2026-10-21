// Injected only into the smoke child process. Production URL checks are unchanged.
import dns from "node:dns/promises";
import { syncBuiltinESMExports } from "node:module";

if (process.env.NODE_ENV === "production" || !process.env.UI_SMOKE_PROVIDER_TARGET) {
  throw new Error("The smoke transport may only be loaded by the development test harness.");
}
const target = new URL(process.env.UI_SMOKE_PROVIDER_TARGET);
if (target.protocol !== "http:" || target.hostname !== "127.0.0.1") {
  throw new Error("The smoke fixture must listen on loopback.");
}
const fixtureHost = "ui-smoke.invalid";
const originalLookup = dns.lookup;
dns.lookup = async (hostname, options) => {
  if (hostname !== fixtureHost) return originalLookup(hostname, options);
  const record = { address: "93.184.216.34", family: 4 };
  return options?.all ? [record] : record;
};
syncBuiltinESMExports();

const originalFetch = globalThis.fetch;
globalThis.fetch = (input, init) => {
  const url = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if (url.hostname !== fixtureHost) return originalFetch(input, init);
  url.protocol = target.protocol;
  url.host = target.host;
  return originalFetch(url, init);
};
