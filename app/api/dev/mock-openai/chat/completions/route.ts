import { NextResponse } from "next/server";
import { z } from "zod";

const requestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(
    z.object({
      role: z.enum(["system", "user", "assistant"]),
      content: z.string().min(1),
    }),
  ),
});

function buildMockReply(model: string, messages: Array<{ role: "system" | "user" | "assistant"; content: string }>) {
  const normalizedModel = model.toLowerCase();
  const assistantMessages = messages.filter((message) => message.role === "assistant");
  const userMessages = messages.filter((message) => message.role === "user");
  const lastUserMessage = userMessages.at(-1)?.content ?? "你好";

  if (lastUserMessage.trim().toLowerCase() === "ping") {
    return `${model} 已连通，本地模拟接口返回 pong。`;
  }

  if (normalizedModel.includes("alpha")) {
    return `【${model}】我先开个头：围绕“${lastUserMessage}”，建议先列出目标、限制和可执行的下一步。`;
  }

  if (normalizedModel.includes("beta")) {
    return `【${model}】我看到了前面 ${assistantMessages.length} 条 AI 回复，我补充一个实现视角：先做最小闭环，再逐步扩展。`;
  }

  if (normalizedModel.includes("gamma")) {
    return `【${model}】我来收束一下：当前上下文里最后一条用户输入是“${lastUserMessage}”，可以先验证主流程再优化体验。`;
  }

  return `【${model}】本地模拟接口已收到消息。当前共有 ${messages.length} 条上下文，其中 ${assistantMessages.length} 条来自 AI。`;
}

export async function POST(request: Request) {
  const body = requestSchema.parse(await request.json());
  const content = buildMockReply(body.model, body.messages);

  return NextResponse.json({
    id: `mock-${Date.now()}`,
    object: "chat.completion",
    created: Math.floor(Date.now() / 1000),
    model: body.model,
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: {
          role: "assistant",
          content,
        },
      },
    ],
  });
}

