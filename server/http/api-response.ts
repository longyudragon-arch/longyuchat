import { NextResponse } from "next/server";

import { getOrCreateRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";

export function withRequestIdHeader(request: Request, response: NextResponse) {
  response.headers.set(REQUEST_ID_HEADER, getOrCreateRequestId(request));
  return response;
}

export function jsonWithRequestId(
  request: Request,
  payload: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(payload, init);
  return withRequestIdHeader(request, response);
}

export function emptyWithRequestId(request: Request, init?: ResponseInit) {
  return withRequestIdHeader(request, new NextResponse(null, init));
}
