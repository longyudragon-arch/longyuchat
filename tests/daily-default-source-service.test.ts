import { describe, expect, it } from "vitest";

import { getDefaultDailySourceDefinitions } from "@/server/services/daily-default-source-service";

describe("getDefaultDailySourceDefinitions", () => {
  it("returns a stable curated starter set", () => {
    const sources = getDefaultDailySourceDefinitions();

    expect(sources.length).toBeGreaterThanOrEqual(6);
    expect(sources.some((source) => source.name === "OpenAI News")).toBe(true);
    expect(sources.some((source) => source.name === "Hacker News Top Stories")).toBe(true);
    expect(sources.some((source) => source.name === "GitHub Releases / vercel/ai")).toBe(true);
  });
});
