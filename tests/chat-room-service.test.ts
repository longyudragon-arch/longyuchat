import { describe, expect, it } from "vitest";

import { buildReorderSortPlan } from "@/server/services/chat-room-service";

describe("buildReorderSortPlan", () => {
  it("moves all room models to temporary slots before assigning final sort orders", () => {
    const plan = buildReorderSortPlan(["model-b", "model-a", "model-c"]);

    expect(plan.temporary).toEqual([
      { modelId: "model-b", sortOrder: 4 },
      { modelId: "model-a", sortOrder: 5 },
      { modelId: "model-c", sortOrder: 6 },
    ]);

    expect(plan.final).toEqual([
      { modelId: "model-b", sortOrder: 1 },
      { modelId: "model-a", sortOrder: 2 },
      { modelId: "model-c", sortOrder: 3 },
    ]);
  });
});
