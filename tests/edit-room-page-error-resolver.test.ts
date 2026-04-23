import { describe, expect, it } from "vitest";

import { ClientRequestError, type ClientErrorFeedback } from "@/lib/client/longyuchat-client";
import { resolveRoomConfigFieldErrors } from "@/components/edit-room-page-error-resolver";

const genericFeedback: ClientErrorFeedback = {
  title: "操作没有完成",
  description: "请求失败。",
  suggestion: "请稍后重试。",
  tone: "error",
};

describe("resolveRoomConfigFieldErrors", () => {
  it("maps structured room title hints to the title field", () => {
    const fieldErrors = resolveRoomConfigFieldErrors(
      new ClientRequestError("Room title is required.", 400, {
        reasonCode: "room_title_required",
        fieldHints: ["title"],
      }),
      genericFeedback,
    );

    expect(fieldErrors.title).toContain("房间名称");
  });

  it("maps room type and model selection hints together", () => {
    const fieldErrors = resolveRoomConfigFieldErrors(
      new ClientRequestError("Group chat rooms must include at least two models.", 400, {
        reasonCode: "room_group_requires_two_models",
        fieldHints: ["type", "modelIds"],
      }),
      genericFeedback,
    );

    expect(fieldErrors.type).toContain("房间类型");
    expect(fieldErrors.modelIds).toContain("成员");
  });

  it("falls back to feedback heuristics when no structured hints are available", () => {
    const fieldErrors = resolveRoomConfigFieldErrors(
      new Error("Each model can only appear once in a room."),
      {
        title: "同一个模型不能重复加入房间",
        description: "请去掉重复的模型。",
        suggestion: "修改后重试。",
        tone: "warning",
      },
    );

    expect(fieldErrors.modelIds).toContain("重复");
  });
});
