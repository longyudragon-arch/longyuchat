import type { ProviderType, RoomView } from "@/types/app";

type CurrentConversationRoundStep = NonNullable<RoomView["currentRound"]>["steps"][number];

export function getProviderMessageSurfaceClassName(provider?: ProviderType) {
  switch (provider) {
    case "OPENAI_COMPATIBLE":
      return "border-emerald-200/70 shadow-[0_10px_28px_rgba(16,185,129,0.08)]";
    case "CLAUDE":
      return "border-amber-200/80 shadow-[0_10px_28px_rgba(245,158,11,0.08)]";
    case "GEMINI":
      return "border-sky-200/80 shadow-[0_10px_28px_rgba(14,165,233,0.08)]";
    case "GROK":
      return "border-violet-200/80 shadow-[0_10px_28px_rgba(139,92,246,0.08)]";
    case "DOUBAO":
      return "border-orange-200/80 shadow-[0_10px_28px_rgba(249,115,22,0.08)]";
    case "DEEPSEEK":
      return "border-cyan-200/80 shadow-[0_10px_28px_rgba(6,182,212,0.08)]";
    case "MODELSCOPE":
      return "border-fuchsia-200/80 shadow-[0_10px_28px_rgba(217,70,239,0.08)]";
    case "HUNYUAN":
      return "border-rose-200/80 shadow-[0_10px_28px_rgba(244,63,94,0.08)]";
    case "QWEN":
      return "border-indigo-200/80 shadow-[0_10px_28px_rgba(99,102,241,0.08)]";
    default:
      return "border-stone-200/70 shadow-[0_8px_24px_rgba(0,0,0,0.03)]";
  }
}

export function getProviderAccentClassName(provider?: ProviderType) {
  switch (provider) {
    case "OPENAI_COMPATIBLE":
      return "bg-emerald-500";
    case "CLAUDE":
      return "bg-amber-500";
    case "GEMINI":
      return "bg-sky-500";
    case "GROK":
      return "bg-violet-500";
    case "DOUBAO":
      return "bg-orange-500";
    case "DEEPSEEK":
      return "bg-cyan-500";
    case "MODELSCOPE":
      return "bg-fuchsia-500";
    case "HUNYUAN":
      return "bg-rose-500";
    case "QWEN":
      return "bg-indigo-500";
    default:
      return "bg-stone-400";
  }
}

export function formatFailureKindLabel(kind: string) {
  switch (kind) {
    case "authentication":
      return "鉴权失败";
    case "quota":
      return "额度不足";
    case "network":
      return "网络或超时";
    case "not_found":
      return "模型或接口不存在";
    case "empty_response":
      return "空回复";
    case "reasoning_only":
      return "仅推理无正文";
    default:
      return "调用失败";
  }
}

export function isRoomModelCoolingDown(roomModel: RoomView["roomModels"][number], now = new Date()) {
  if (roomModel.executionState !== "COOLDOWN" || !roomModel.cooldownUntil) {
    return false;
  }

  return new Date(roomModel.cooldownUntil).getTime() > now.getTime();
}

export function isRoomModelHalfOpen(roomModel: RoomView["roomModels"][number]) {
  return roomModel.executionState === "HALF_OPEN";
}

export function isRoundStepCompleted(step: CurrentConversationRoundStep) {
  return step.status === "REPLIED" || step.status === "FAILED";
}
