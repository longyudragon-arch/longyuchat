import { EventEmitter } from "node:events";
import type { ClientRequest, IncomingMessage, RequestOptions } from "node:http";
import { PassThrough } from "node:stream";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { lookupMock, requestMock } = vi.hoisted(() => ({ lookupMock: vi.fn(), requestMock: vi.fn() }));
vi.mock("node:dns/promises", () => ({ lookup: lookupMock }));
vi.mock("node:http", () => ({ default: { request: requestMock } }));
vi.mock("node:https", () => ({ default: { request: requestMock } }));

import { isPublicIpAddress, requestPublicText, resolvePublicHttpUrl } from "@/server/http/public-http";

function reply(status: number, body: string[], headers: Record<string, string> = {}, stall = false) {
  requestMock.mockImplementationOnce((_url: URL, options: RequestOptions, callback: (response: IncomingMessage) => void) => {
    const request = new EventEmitter() as ClientRequest;
    const response = new PassThrough() as unknown as IncomingMessage;
    response.statusCode = status;
    response.headers = headers;
    const abort = () => request.emit("error", new Error("aborted"));
    options.signal?.addEventListener("abort", abort, { once: true });
    request.end = vi.fn(() => {
      queueMicrotask(() => {
        callback(response);
        for (const chunk of body) {
          if (!response.destroyed) (response as unknown as PassThrough).write(Buffer.from(chunk));
        }
        if (!stall && !response.destroyed) (response as unknown as PassThrough).end();
      });
      return request;
    }) as ClientRequest["end"];
    return request;
  });
}

beforeEach(() => {
  lookupMock.mockReset().mockResolvedValue([{ address: "93.184.216.34", family: 4 }]);
  requestMock.mockReset();
});

describe("public URL validation", () => {
  it.each([
    "http://127.0.0.1/feed", "http://2130706433/feed", "http://0x7f000001/feed",
    "http://10.1.2.3/feed", "http://169.254.169.254/latest", "http://100.64.0.1/feed",
    "http://[::1]/feed", "http://[::ffff:127.0.0.1]/feed", "http://[fe80::1]/feed",
    "http://[fd00::1]/feed", "http://localhost./feed", "http://foo.localhost/feed",
    "file:///etc/passwd", "https://user:password@example.com/feed", "http://224.0.0.1/feed",
  ])("rejects non-public or credential-bearing URL %s", async (url) => {
    await expect(resolvePublicHttpUrl(url)).rejects.toThrow("not allowed");
    expect(requestMock).not.toHaveBeenCalled();
  });

  it("checks every DNS answer and fails closed on failed/empty resolution", async () => {
    lookupMock.mockResolvedValueOnce([{ address: "93.184.216.34", family: 4 }, { address: "10.0.0.1", family: 4 }]);
    await expect(resolvePublicHttpUrl("https://mixed.example")).rejects.toThrow("not allowed");
    lookupMock.mockResolvedValueOnce([]);
    await expect(resolvePublicHttpUrl("https://empty.example")).rejects.toThrow("not allowed");
    lookupMock.mockRejectedValueOnce(new Error("ENOTFOUND"));
    await expect(resolvePublicHttpUrl("https://missing.example")).rejects.toThrow("Could not resolve");
  });

  it("permits normal global IPv4/IPv6 and rejects embedded-address transition ranges", () => {
    expect(isPublicIpAddress("93.184.216.34")).toBe(true);
    expect(isPublicIpAddress("2606:4700:4700::1111")).toBe(true);
    expect(isPublicIpAddress("2002:7f00:1::")).toBe(false);
    expect(isPublicIpAddress("64:ff9b::7f00:1")).toBe(false);
  });
});

describe("bounded public HTTP fetch", () => {
  it("pins the validated DNS address while preserving the original URL and hostname", async () => {
    reply(200, ["<rss>", "</rss>"]);
    await expect(requestPublicText("https://feed.example/rss")).resolves.toMatchObject({ status: 200, bodyText: "<rss></rss>" });
    const [url, options] = requestMock.mock.calls[0];
    expect(url.hostname).toBe("feed.example");
    expect(options).toMatchObject({ family: 4, agent: false });
    const resolved = vi.fn();
    options.lookup("feed.example", {}, resolved);
    expect(resolved).toHaveBeenCalledWith(null, "93.184.216.34", 4);
    expect(lookupMock).toHaveBeenCalledOnce();
  });

  it("validates each redirect and blocks a redirect into a private network", async () => {
    reply(302, [], { location: "http://127.0.0.1/private" });
    await expect(requestPublicText("http://feed.example/rss")).rejects.toThrow("not allowed");
    expect(requestMock).toHaveBeenCalledOnce();
  });

  it("follows bounded relative redirects and checks DNS again", async () => {
    reply(302, [], { location: "/new-feed" });
    reply(200, ["feed"]);
    await expect(requestPublicText("https://feed.example/rss")).resolves.toMatchObject({ bodyText: "feed" });
    expect(requestMock.mock.calls[1][0].pathname).toBe("/new-feed");
    expect(lookupMock).toHaveBeenCalledTimes(2);
  });

  it("rejects redirect loops and HTTPS downgrades", async () => {
    reply(302, [], { location: "/rss" });
    await expect(requestPublicText("https://feed.example/rss", { maxRedirects: 0 })).rejects.toThrow("redirect limit");
    reply(302, [], { location: "http://feed.example/rss" });
    await expect(requestPublicText("https://feed.example/rss")).rejects.toThrow("insecure redirect");
  });

  it("bounds chunked response bodies even without Content-Length", async () => {
    reply(200, ["1234", "5678"]);
    await expect(requestPublicText("https://feed.example/rss", { maxBytes: 5 })).rejects.toThrow("size limit");
  });

  it("rejects oversized declared bodies before reading data", async () => {
    reply(200, [], { "content-length": "999" });
    await expect(requestPublicText("https://feed.example/rss", { maxBytes: 5 })).rejects.toThrow("size limit");
  });

  it("applies the timeout to stalled response bodies", async () => {
    reply(200, [], {}, true);
    await expect(requestPublicText("https://feed.example/rss", { timeoutMs: 10 })).rejects.toThrow("timed out");
  });

  it("applies the same timeout to stalled DNS", async () => {
    lookupMock.mockImplementationOnce(() => new Promise(() => {}));
    await expect(requestPublicText("https://feed.example/rss", { timeoutMs: 10 })).rejects.toThrow("timed out");
    expect(requestMock).not.toHaveBeenCalled();
  });
});
