import { describe, expect, it } from "vitest";

import { getDefaultDailyMajorEventDefinitions } from "@/server/services/daily-major-event-service";

describe("getDefaultDailyMajorEventDefinitions", () => {
  it("keeps a source-backed chronological starter timeline", () => {
    const events = getDefaultDailyMajorEventDefinitions();
    const dates = events.map((event) => event.eventDate);

    expect(events.length).toBeGreaterThanOrEqual(10);
    expect(events.some((event) => event.title.includes("GPT-5.5"))).toBe(true);
    expect(events.every((event) => event.sourceUrl.startsWith("https://"))).toBe(true);
    expect([...dates].sort()).toEqual(dates);
  });
});
