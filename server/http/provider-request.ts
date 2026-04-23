import { execFile } from "node:child_process";
import { isIP } from "node:net";
import { lookup } from "node:dns/promises";
import { getProviderRequestTimeoutMs } from "@/lib/runtime";

interface ProviderRequestInput {
  url: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  timeoutMs?: number;
}

interface ProviderRequestResult {
  ok: boolean;
  status: number;
  bodyText: string;
  transport: "fetch" | "powershell";
}

interface ProviderRequestPayload {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
  timeoutMs: number;
}

interface PowerShellRequestResult {
  ok: boolean;
  status: number;
  body: string;
}

interface ExecFileResult {
  stdout: string;
  stderr: string;
}

function stripByteOrderMark(value: string) {
  return value.charCodeAt(0) === 0xfeff ? value.slice(1) : value;
}

function getTimeoutMs(timeoutMs?: number) {
  return timeoutMs ?? getProviderRequestTimeoutMs();
}

function getPowerShellCommand() {
  if (process.platform !== "win32") {
    return "powershell";
  }

  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  return `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
}

function isLoopbackOrPrivateIpv4(address: string) {
  const octets = address.split(".").map((value) => Number.parseInt(value, 10));

  if (octets.length !== 4 || octets.some((value) => Number.isNaN(value) || value < 0 || value > 255)) {
    return false;
  }

  const [first, second] = octets;

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 198 && (second === 18 || second === 19))
  );
}

function isLoopbackOrPrivateIpv6(address: string) {
  const normalized = address.toLowerCase();

  if (normalized === "::1" || normalized === "::") {
    return true;
  }

  if (normalized.startsWith("::ffff:")) {
    return isLoopbackOrPrivateIpv4(normalized.slice("::ffff:".length));
  }

  return normalized.startsWith("fc") || normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb");
}

function isDisallowedIpAddress(address: string) {
  const family = isIP(address);

  if (family === 4) {
    return isLoopbackOrPrivateIpv4(address);
  }

  if (family === 6) {
    return isLoopbackOrPrivateIpv6(address);
  }

  return false;
}

function getPowerShellRequestEnv(encodedPayload: string) {
  const env: Record<string, string> = {
    CODEX_PROVIDER_REQUEST_PAYLOAD: encodedPayload,
  };

  if (process.env.SystemRoot) {
    env.SystemRoot = process.env.SystemRoot;
  }

  return env as NodeJS.ProcessEnv;
}

async function assertAllowedProviderUrl(rawUrl: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    throw new Error("Provider URL is not allowed.");
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Provider URL is not allowed.");
  }

  const hostname = parsedUrl.hostname.trim().toLowerCase();

  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost")) {
    throw new Error("Provider URL is not allowed.");
  }

  if (isDisallowedIpAddress(hostname)) {
    throw new Error("Provider URL is not allowed.");
  }

  try {
    const resolved = await lookup(hostname, { all: true });
    const records = Array.isArray(resolved) ? resolved : [resolved];

    if (records.some((record) => isDisallowedIpAddress(record.address))) {
      throw new Error("Provider URL is not allowed.");
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Provider URL is not allowed.") {
      throw error;
    }
  }
}

function toProviderRequestPayload(input: ProviderRequestInput): ProviderRequestPayload {
  return {
    url: input.url,
    method: input.method ?? "POST",
    headers: input.headers ?? {},
    body: input.body ?? "",
    timeoutMs: getTimeoutMs(input.timeoutMs),
  };
}

function getErrorCause(error: unknown) {
  if (!(error instanceof Error)) {
    return undefined;
  }

  return (error as Error & { cause?: { code?: string; message?: string } }).cause;
}

function formatTimeoutLabel(timeoutMs: number) {
  if (timeoutMs % 1000 === 0) {
    return `${timeoutMs / 1000}s`;
  }

  return `${timeoutMs}ms`;
}

function shouldUsePowerShellFallback(error: unknown) {
  if (process.platform !== "win32") {
    return false;
  }

  if (!(error instanceof Error)) {
    return false;
  }

  const cause = getErrorCause(error);

  return (
    error.message === "fetch failed" ||
    cause?.code === "UND_ERR_CONNECT_TIMEOUT" ||
    cause?.code === "UND_ERR_HEADERS_TIMEOUT" ||
    cause?.code === "UND_ERR_SOCKET"
  );
}

function toProviderTransportError(url: string, timeoutMs: number, error: unknown, fallbackError?: unknown) {
  if (!(error instanceof Error)) {
    return new Error(`Could not reach ${url}.`);
  }

  const cause = getErrorCause(error);
  const fallbackDetail =
    fallbackError instanceof Error ? ` PowerShell fallback also failed: ${fallbackError.message}` : "";
  const timeoutLabel = formatTimeoutLabel(timeoutMs);

  if (cause?.code === "UND_ERR_CONNECT_TIMEOUT") {
    return new Error(
      `Could not reach ${url}. Provider request timed out after ${timeoutLabel} before the provider responded.${fallbackDetail}`,
    );
  }

  if (cause?.message) {
    return new Error(`Could not reach ${url}. ${cause.message}.${fallbackDetail}`);
  }

  return new Error(`Could not reach ${url}. ${error.message}.${fallbackDetail}`);
}

async function requestWithFetch(input: ProviderRequestPayload): Promise<ProviderRequestResult> {
  const response = await fetch(input.url, {
    method: input.method,
    headers: input.headers,
    body: input.body || undefined,
    redirect: "manual",
    signal: AbortSignal.timeout(input.timeoutMs),
  });
  const bodyText =
    typeof response.text === "function"
      ? await response.text()
      : JSON.stringify(await response.json());

  return {
    ok: response.ok,
    status: response.status,
    bodyText,
    transport: "fetch",
  };
}

async function requestWithPowerShell(input: ProviderRequestPayload): Promise<ProviderRequestResult> {
  const encodedPayload = Buffer.from(JSON.stringify(input), "utf8").toString("base64");
  const script = `
$ErrorActionPreference = "Stop"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$OutputEncoding = $utf8
[Console]::OutputEncoding = $utf8
Add-Type -AssemblyName System.Net.Http
$payloadJson = [System.Text.Encoding]::UTF8.GetString([System.Convert]::FromBase64String($env:CODEX_PROVIDER_REQUEST_PAYLOAD))
$payload = $payloadJson | ConvertFrom-Json
$handler = New-Object System.Net.Http.HttpClientHandler
$client = New-Object System.Net.Http.HttpClient($handler)
$client.Timeout = [TimeSpan]::FromMilliseconds([double]$payload.timeoutMs)
$method = New-Object System.Net.Http.HttpMethod([string]$payload.method)
$request = New-Object System.Net.Http.HttpRequestMessage($method, [string]$payload.url)
if ($payload.headers) {
  foreach ($property in $payload.headers.PSObject.Properties) {
    if ([string]$property.Name -ne "Content-Type") {
      $request.Headers.TryAddWithoutValidation([string]$property.Name, [string]$property.Value) | Out-Null
    }
  }
}
if ($payload.body) {
  $contentType = "application/json"
  if ($payload.headers -and $payload.headers."Content-Type") {
    $contentType = [string]$payload.headers."Content-Type"
  }
  $request.Content = New-Object System.Net.Http.StringContent([string]$payload.body, [System.Text.Encoding]::UTF8, $contentType)
}
$response = $client.SendAsync($request).GetAwaiter().GetResult()
$body = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
@{
  ok = [bool]$response.IsSuccessStatusCode
  status = [int]$response.StatusCode.value__
  body = $body
} | ConvertTo-Json -Compress -Depth 6
`.trim();

  const { stdout } = await new Promise<ExecFileResult>((resolve, reject) => {
    execFile(
      getPowerShellCommand(),
      ["-NoProfile", "-Command", script],
      {
        cwd: process.cwd(),
        env: getPowerShellRequestEnv(encodedPayload),
        maxBuffer: 1024 * 1024,
        timeout: input.timeoutMs + 5_000,
        windowsHide: true,
      },
      (error, childStdout, childStderr) => {
        if (error) {
          reject(error);
          return;
        }

        resolve({
          stdout: childStdout,
          stderr: childStderr,
        });
      },
    );
  });

  const payload = JSON.parse(stripByteOrderMark(stdout).trim()) as PowerShellRequestResult;

  return {
    ok: payload.ok,
    status: payload.status,
    bodyText: payload.body,
    transport: "powershell",
  };
}

export async function requestProvider(input: ProviderRequestInput): Promise<ProviderRequestResult> {
  const payload = toProviderRequestPayload(input);
  await assertAllowedProviderUrl(payload.url);

  try {
    return await requestWithFetch(payload);
  } catch (error) {
    if (shouldUsePowerShellFallback(error)) {
      try {
        return await requestWithPowerShell(payload);
      } catch (fallbackError) {
        throw toProviderTransportError(payload.url, payload.timeoutMs, error, fallbackError);
      }
    }

    throw toProviderTransportError(payload.url, payload.timeoutMs, error);
  }
}
