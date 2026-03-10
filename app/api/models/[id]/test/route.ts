import { NextResponse } from "next/server";

import { handleRouteError } from "@/server/http/api-error";
import { presentModelConfig } from "@/server/presenters/api-presenters";
import { testModelConnectionById } from "@/server/services/model-config-service";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function POST(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const model = await testModelConnectionById(id);

    return NextResponse.json({
      ok: true,
      model: presentModelConfig(model),
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
