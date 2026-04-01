import { Prisma } from "@/generated/prisma/client";
import { getOrCreateRequestId, REQUEST_ID_HEADER } from "@/lib/request-id";
import { logRouteError } from "@/server/observability/server-logger";
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function fromPrismaError(error: Prisma.PrismaClientKnownRequestError) {
  if (error.code === "P2002") {
    return new ApiError(409, "The record already exists.", {
      reasonCode: "record_already_exists",
      retryable: false,
      fieldHints: Array.isArray(error.meta?.target)
        ? (error.meta?.target as string[])
        : typeof error.meta?.target === "string"
          ? [error.meta.target]
          : undefined,
      target: error.meta?.target,
    });
  }

  if (error.code === "P2003") {
    return new ApiError(409, "The record is still referenced by other data.", {
      reasonCode: "record_still_referenced",
      retryable: false,
    });
  }

  if (error.code === "P2025") {
    return new ApiError(404, "The requested record was not found.", {
      reasonCode: "record_not_found",
      retryable: false,
    });
  }

  return new ApiError(500, "A database error occurred.", {
    reasonCode: "database_error",
    retryable: true,
  });
}

export function normalizeApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ZodError) {
    const flattened = error.flatten();
    return new ApiError(400, "Invalid request payload.", {
      ...flattened,
      reasonCode: "invalid_request_payload",
      retryable: false,
      fieldHints: Object.keys(flattened.fieldErrors),
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return fromPrismaError(error);
  }

  if (error instanceof SyntaxError) {
    return new ApiError(400, "Request body must be valid JSON.", {
      reasonCode: "invalid_json_body",
      retryable: false,
      fieldHints: ["requestBody"],
    });
  }

  if (error instanceof Error) {
    return new ApiError(400, error.message);
  }

  return new ApiError(500, "An unexpected error occurred.");
}

export function handleRouteError(error: unknown, request?: Request) {
  const normalized = normalizeApiError(error);
  const requestId = getOrCreateRequestId(request);

  logRouteError({
    requestId,
    request,
    status: normalized.status,
    error,
    details: normalized.details,
  });

  const response = NextResponse.json(
    {
      error: normalized.message,
      details: normalized.details,
      requestId,
    },
    {
      status: normalized.status,
    },
  );

  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}
