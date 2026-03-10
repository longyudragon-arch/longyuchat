import { execFile } from "node:child_process";
const providerRequestTimeoutMs = 60_000;

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
  return timeoutMs ?? providerRequestTimeoutMs;
}

function getPowerShellCommand() {
  if (process.platform !== "win32") {
    return "powershell";
  }

  const systemRoot = process.env.SystemRoot ?? "C:\\Windows";
  return `${systemRoot}\\System32\\WindowsPowerShell\\v1.0\\powershell.exe`;
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

function toProviderTransportError(url: string, error: unknown, fallbackError?: unknown) {
  if (!(error instanceof Error)) {
    return new Error(`Could not reach ${url}.`);
  }

  const cause = getErrorCause(error);
  const fallbackDetail =
    fallbackError instanceof Error ? ` PowerShell fallback also failed: ${fallbackError.message}` : "";

  if (cause?.code === "UND_ERR_CONNECT_TIMEOUT") {
    return new Error(
      `Could not reach ${url}. Node network connection timed out before the provider responded.${fallbackDetail}`,
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
        env: {
          ...process.env,
          CODEX_PROVIDER_REQUEST_PAYLOAD: encodedPayload,
        },
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

  try {
    return await requestWithFetch(payload);
  } catch (error) {
    if (shouldUsePowerShellFallback(error)) {
      try {
        return await requestWithPowerShell(payload);
      } catch (fallbackError) {
        throw toProviderTransportError(payload.url, error, fallbackError);
      }
    }

    throw toProviderTransportError(payload.url, error);
  }
}
