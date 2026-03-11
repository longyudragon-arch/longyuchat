import { areDevMocksEnabledForServer } from "@/lib/runtime";
import { jsonWithRequestId } from "@/server/http/api-response";

const mockModels = [
  {
    id: "mock-alpha",
    object: "model",
    owned_by: "local-mock",
  },
  {
    id: "mock-beta",
    object: "model",
    owned_by: "local-mock",
  },
  {
    id: "mock-gamma",
    object: "model",
    owned_by: "local-mock",
  },
] as const;

export async function GET(request: Request) {
  if (!areDevMocksEnabledForServer()) {
    return jsonWithRequestId(request, { error: "The requested record was not found." }, { status: 404 });
  }

  return jsonWithRequestId(request, {
    object: "list",
    data: mockModels,
  });
}
