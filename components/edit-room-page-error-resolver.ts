import type { ClientErrorFeedback } from "@/lib/client/longyuchat-client";
import { getClientErrorFieldHints } from "@/lib/client/error-field-hints";

export type RoomConfigFieldKey = "title" | "type" | "modelIds";

function appendFieldError(
  current: Partial<Record<RoomConfigFieldKey, string>>,
  key: RoomConfigFieldKey,
  message: string,
) {
  if (!current[key]) {
    current[key] = message;
  }
}

function resolveRoomConfigFieldErrorsFromFeedback(
  feedback: ClientErrorFeedback,
): Partial<Record<RoomConfigFieldKey, string>> {
  if (feedback.title.includes("房间名称不能为空")) {
    return { title: "请先填写一个清晰的房间名称。" };
  }

  if (feedback.title.includes("单聊必须且只能选择 1 个模型")) {
    return {
      type: "当前房间类型为单聊，只能保留 1 个模型。",
      modelIds: "请只保留 1 个模型，或切换回群聊模式。",
    };
  }

  if (feedback.title.includes("群聊至少需要 2 个模型")) {
    return {
      type: "当前房间类型为群聊，至少需要 2 个模型。",
      modelIds: "请至少选择 2 个可用模型，才能保存群聊配置。",
    };
  }

  if (feedback.title.includes("同一个模型不能重复加入房间")) {
    return {
      modelIds: "同一个模型在同一房间里只能出现一次，请去掉重复项后再保存。",
    };
  }

  return {};
}

export function resolveRoomConfigFieldErrors(
  error: unknown,
  feedback: ClientErrorFeedback,
): Partial<Record<RoomConfigFieldKey, string>> {
  const resolved: Partial<Record<RoomConfigFieldKey, string>> = {};

  for (const hint of getClientErrorFieldHints(error)) {
    switch (hint) {
      case "title":
        appendFieldError(resolved, "title", "请先填写一个清晰的房间名称。");
        break;
      case "type":
        appendFieldError(resolved, "type", "请重新确认当前房间类型与成员数量是否匹配。");
        break;
      case "modelIds":
        appendFieldError(resolved, "modelIds", "请检查房间成员数量是否满足当前房间类型要求。");
        break;
      default:
        break;
    }
  }

  if (Object.keys(resolved).length > 0) {
    return resolved;
  }

  return resolveRoomConfigFieldErrorsFromFeedback(feedback);
}
