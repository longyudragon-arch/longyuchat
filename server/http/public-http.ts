import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import { isIP } from "node:net";

interface PublicAddress {
  address: string;
  family: number;
}

function isPublicIpv4(address: string) {
  const [a, b, c] = address.split(".").map(Number);
  return !(
    a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || (b === 51 && c === 100))) ||
    (a === 203 && b === 0 && c === 113)
  );
}

export function isPublicIpAddress(address: string) {
  const family = isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;

  // Permit global unicast only. This also excludes mapped/compatible IPv4,
  // NAT64, loopback, link-local, unique-local and multicast addresses.
  const normalized = address.toLowerCase();
  const [first, second = "0"] = normalized.split(":");
  const prefix = Number.parseInt(first, 16);
  const next = Number.parseInt(second || "0", 16);
  return prefix >= 0x2000 && prefix <= 0x3fff &&
    prefix !== 0x2002 && // 6to4 can embed an otherwise forbidden IPv4 target.
    prefix !== 0x3fff && // Documentation prefix.
    !(prefix === 0x2001 && (next < 0x200 || next === 0xdb8));
}

async function withAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  signal.throwIfAborted();
  return new Promise<T>((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener("abort", abort, { once: true });
    promise.then(resolve, reject).finally(() => signal.removeEventListener("abort", abort));
  });
}

export async function resolvePublicHttpUrl(rawUrl: string, signal?: AbortSignal) {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new Error("Public HTTP URL is not allowed.");
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
      !hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Public HTTP URL is not allowed.");
  }

  let addresses: PublicAddress[];
  const family = isIP(hostname);
  if (family) {
    addresses = [{ address: hostname, family }];
  } else {
    try {
      addresses = await withAbort(lookup(hostname, { all: true }), signal);
    } catch (error) {
      signal?.throwIfAborted();
      throw new Error("Could not resolve public HTTP host.", { cause: error });
    }
  }

  if (!addresses.length || addresses.some(({ address }) => !isPublicIpAddress(address))) {
    throw new Error("Public HTTP URL is not allowed.");
  }

  return { url, addresses };
}

interface PublicHttpInput {
  headers?: Record<string, string>;
  timeoutMs?: number;
  maxBytes?: number;
  maxRedirects?: number;
}

interface PublicHttpResponse {
  status: number;
  bodyText: string;
  location?: string;
}

function requestResolvedUrl(
  target: Awaited<ReturnType<typeof resolvePublicHttpUrl>>,
  headers: Record<string, string>,
  maxBytes: number,
  signal: AbortSignal,
): Promise<PublicHttpResponse> {
  return new Promise((resolve, reject) => {
    const transport = target.url.protocol === "https:" ? https : http;
    const address = target.addresses[0];
    const request = transport.request(target.url, {
      method: "GET",
      headers,
      agent: false,
      family: address.family,
      // Keep the original Host header and TLS hostname while connecting only
      // to an address from this validation pass; do not resolve DNS twice.
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
      signal,
    }, (response) => {
      const status = response.statusCode ?? 502;
      if (status >= 300 && status < 400) {
        response.destroy();
        resolve({ status, bodyText: "", location: response.headers.location });
        return;
      }

      response.once("error", reject);
      const chunks: Buffer[] = [];
      let bytes = 0;
      if (Number(response.headers["content-length"]) > maxBytes) {
        response.destroy(new Error("Public HTTP response exceeded the size limit."));
        return;
      }
      response.on("data", (chunk: Buffer) => {
        bytes += chunk.length;
        if (bytes > maxBytes) {
          response.destroy(new Error("Public HTTP response exceeded the size limit."));
          return;
        }
        chunks.push(chunk);
      });
      response.once("end", () => resolve({ status, bodyText: Buffer.concat(chunks).toString("utf8") }));
    });
    request.once("error", reject);
    request.end();
  });
}

export async function requestPublicText(rawUrl: string, input: PublicHttpInput = {}) {
  const timeoutMs = input.timeoutMs ?? 15_000;
  const maxBytes = input.maxBytes ?? 2 * 1024 * 1024;
  const maxRedirects = input.maxRedirects ?? 3;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || !Number.isSafeInteger(maxBytes) || maxBytes <= 0 ||
      !Number.isSafeInteger(maxRedirects) || maxRedirects < 0) {
    throw new Error("Invalid public HTTP request limits.");
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new Error("Public HTTP request timed out.")), timeoutMs);
  let nextUrl = rawUrl;
  try {
    for (let redirects = 0; ; redirects += 1) {
      const target = await resolvePublicHttpUrl(nextUrl, controller.signal);
      const result = await requestResolvedUrl(target, input.headers ?? {}, maxBytes, controller.signal);
      if (result.status < 300 || result.status >= 400) return result;
      if (!result.location || redirects >= maxRedirects) throw new Error("Public HTTP redirect limit exceeded.");
      const redirected = new URL(result.location, target.url);
      if (target.url.protocol === "https:" && redirected.protocol !== "https:") {
        throw new Error("Public HTTP insecure redirect is not allowed.");
      }
      nextUrl = redirected.toString();
    }
  } catch (error) {
    controller.signal.throwIfAborted();
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
