import type { GenerateReplyInput, ModelAdapter, ModelReply } from "@/server/adapters/model-adapter";
import type { ModelRuntimeConfig } from "@/types/chat";

interface ChatCompletionChoice {
  message?: {
    content?: string | Array<{ type?: string; text?: string }>;
  };
}

interface ChatCompletionResponse {
  choices?: ChatCompletionChoice[];
}

function normalizeBaseUrl(baseUrl: string) {
  return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function extractContent(payload: ChatCompletionResponse) {
  const content = payload.choices?.[0]?.message?.content;

  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => (part.type === "text" ? part.text ?? "" : ""))
      .join("")
      .trim();
  }

  throw new Error("The provider returned an empty response.");
}

async function postChatCompletion(input: GenerateReplyInput): Promise<ModelReply> {
  const endpoint = `${normalizeBaseUrl(input.config.baseUrl)}/chat/completions`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${input.config.apiKey}`,
    },
    body: JSON.stringify({
      model: input.config.modelName,
      messages: input.messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Provider request failed with ${response.status}: ${errorText}`);
  }

  const payload = (await response.json()) as ChatCompletionResponse;
  const content = extractContent(payload);

  if (!content) {
    throw new Error("The provider returned an empty response.");
  }

  return {
    content,
    raw: payload,
  };
}

export class OpenAiCompatibleAdapter implements ModelAdapter {
  async testConnection(config: ModelRuntimeConfig) {
    await postChatCompletion({
      config,
      messages: [{ role: "user", content: "ping" }],
    });
  }

  async generateReply(input: GenerateReplyInput) {
    return postChatCompletion(input);
  }
}

export function createModelAdapter(config: ModelRuntimeConfig): ModelAdapter {
  if (config.provider === "OPENAI_COMPATIBLE") {
    return new OpenAiCompatibleAdapter();
  }

  throw new Error(`Provider ${config.provider} is not supported in the MVP yet.`);
}

