import { areDevMocksEnabledForClient } from "@/lib/runtime";
import type {
  AuthSessionView,
  CreateProviderConnectionPayload,
  DiscoveredModelView,
  JsonErrorResponse,
  ModelView,
  ProviderCatalogView,
  ProviderConnectionView,
  ProviderType,
  RoomView,
  SendRoomMessageResult,
  TestProviderConnectionPayload,
  UpdateProviderConnectionPayload,
} from "@/types/app";

export class ClientRequestError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const localMockDefinitions = [
  { name: "Mock Alpha", modelName: "mock-alpha" },
  { name: "Mock Beta", modelName: "mock-beta" },
  { name: "Mock Gamma", modelName: "mock-gamma" },
] as const;

function isJsonErrorResponse(value: unknown): value is JsonErrorResponse {
  if (!value || typeof value !== "object") {
    return false;
  }

  const record = value as Record<string, unknown>;
  return "error" in record || "details" in record || "requestId" in record;
}

async function readResponsePayload(response: Response) {
  const payloadText = await response.text();

  if (!payloadText.trim()) {
    return null;
  }

  try {
    return JSON.parse(payloadText) as unknown;
  } catch {
    return payloadText;
  }
}

export function supportsLocalMockTools() {
  return areDevMocksEnabledForClient();
}

export async function fetchJson<T>(input: string, init?: RequestInit) {
  const response = await fetch(input, {
    cache: "no-store",
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (response.status === 204) {
    return null as T;
  }

  const data = await readResponsePayload(response);

  if (!response.ok) {
    const errorPayload = isJsonErrorResponse(data) ? data : null;

    throw new ClientRequestError(
      errorPayload?.error ?? "请求失败。",
      response.status,
      errorPayload?.details,
    );
  }

  return data as T;
}

export function getLocalMockBaseUrl() {
  if (!supportsLocalMockTools()) {
    throw new Error("当前环境没有启用本地 mock 工具。");
  }

  if (typeof window === "undefined") {
    return "http://127.0.0.1:3000/api/dev/mock-openai";
  }

  return `${window.location.origin}/api/dev/mock-openai`;
}

export async function ensureLocalMockModels() {
  if (!supportsLocalMockTools()) {
    throw new Error("当前环境没有启用本地 mock 工具。");
  }

  const baseUrl = getLocalMockBaseUrl();

  await Promise.allSettled(
    localMockDefinitions.map(async (definition) => {
      await fetchJson("/api/models", {
        method: "POST",
        body: JSON.stringify({
          name: definition.name,
          provider: "OPENAI_COMPATIBLE",
          baseUrl,
          modelName: definition.modelName,
          apiKey: "local-test-key",
          defaultReplyLength: 180,
          enabled: true,
        }),
      });
    }),
  );

  const data = await fetchJson<{ models: ModelView[] }>("/api/models");
  const mockModels = localMockDefinitions
    .map((definition) => data.models.find((model) => model.name === definition.name))
    .filter((model): model is ModelView => Boolean(model));

  if (mockModels.length !== localMockDefinitions.length) {
    throw new Error("本地 mock 模型没有完整创建出来，请再试一次。");
  }

  return mockModels;
}

export async function bootstrapLocalTestWorkspace() {
  if (!supportsLocalMockTools()) {
    throw new Error("当前环境没有启用本地 mock 工具。");
  }

  const mockModels = await ensureLocalMockModels();
  const roomTitle = `本地测试群聊 ${new Intl.DateTimeFormat("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date())}`;

  const data = await fetchJson<{ room: RoomView }>("/api/rooms", {
    method: "POST",
    body: JSON.stringify({
      title: roomTitle,
      type: "GROUP",
      modelIds: mockModels.map((model) => model.id),
    }),
  });

  return data.room;
}

export async function sendRoomMessageRequest(roomId: string, content: string) {
  return fetchJson<SendRoomMessageResult>(`/api/rooms/${roomId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}

export async function fetchProviderConnectionsRequest() {
  return fetchJson<{ connections: ProviderConnectionView[] }>("/api/provider-connections");
}

export async function fetchProviderCatalogRequest() {
  return fetchJson<ProviderCatalogView>("/api/provider-catalog");
}

export async function fetchProviderConnectionByIdRequest(connectionId: string) {
  return fetchJson<{ connection: ProviderConnectionView }>(`/api/provider-connections/${connectionId}`);
}

export async function createProviderConnectionRequest(input: CreateProviderConnectionPayload) {
  return fetchJson<{ connection: ProviderConnectionView }>("/api/provider-connections", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateProviderConnectionRequest(
  connectionId: string,
  input: UpdateProviderConnectionPayload,
) {
  return fetchJson<{ connection: ProviderConnectionView }>(`/api/provider-connections/${connectionId}`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function deleteProviderConnectionRequest(connectionId: string) {
  return fetchJson<null>(`/api/provider-connections/${connectionId}`, {
    method: "DELETE",
  });
}

export async function testProviderConnectionRequest(
  connectionId: string,
  input?: TestProviderConnectionPayload,
) {
  return fetchJson<{ ok: true; connection: ProviderConnectionView }>(
    `/api/provider-connections/${connectionId}/test`,
    {
      method: "POST",
      body: input ? JSON.stringify(input) : undefined,
    },
  );
}

export async function discoverProviderModelsByConnectionRequest(connectionId: string) {
  return fetchJson<{ models: DiscoveredModelView[] }>(`/api/provider-connections/${connectionId}/discover-models`, {
    method: "POST",
  });
}

export async function discoverProviderModelsBySavedModelRequest(modelId: string) {
  return fetchJson<{ models: DiscoveredModelView[] }>(`/api/models/${modelId}/discover-models`, {
    method: "POST",
  });
}

export async function discoverProviderModels(input: {
  provider: ProviderType;
  baseUrl: string;
  apiKey: string;
}) {
  return fetchJson<{ models: DiscoveredModelView[] }>("/api/providers/discover-models", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function fetchAuthSession() {
  return fetchJson<AuthSessionView>("/api/auth/session");
}
