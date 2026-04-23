import { describe, expect, it } from "vitest";

import nextConfig from "@/next.config";

describe("next security headers", () => {
  it("defines baseline security headers for all routes", async () => {
    expect(typeof nextConfig.headers).toBe("function");

    const headerGroups = await nextConfig.headers!();
    const allHeaders = headerGroups.flatMap((group) => group.headers);
    const headerMap = new Map(allHeaders.map((header) => [header.key, header.value]));

    expect(headerMap.get("X-Content-Type-Options")).toBe("nosniff");
    expect(headerMap.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
    expect(headerMap.get("X-Frame-Options")).toBe("DENY");
    expect(headerMap.get("Permissions-Policy")).toContain("camera=()");
    expect(headerMap.get("Content-Security-Policy")).toContain("object-src 'none'");
    expect(headerMap.get("Strict-Transport-Security")).toContain("max-age=31536000");
  });
});
