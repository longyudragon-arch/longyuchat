import { NextResponse } from "next/server";

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

export async function GET() {
  return NextResponse.json({
    object: "list",
    data: mockModels,
  });
}
