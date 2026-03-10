import { Prisma } from "@/generated/prisma/client";
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
      target: error.meta?.target,
    });
  }

  if (error.code === "P2003") {
    return new ApiError(409, "The record is still referenced by other data.");
  }

  if (error.code === "P2025") {
    return new ApiError(404, "The requested record was not found.");
  }

  return new ApiError(500, "A database error occurred.");
}

export function normalizeApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }

  if (error instanceof ZodError) {
    return new ApiError(400, "Invalid request payload.", error.flatten());
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return fromPrismaError(error);
  }

  if (error instanceof SyntaxError) {
    return new ApiError(400, "Request body must be valid JSON.");
  }

  if (error instanceof Error) {
    return new ApiError(400, error.message);
  }

  return new ApiError(500, "An unexpected error occurred.");
}

export function handleRouteError(error: unknown) {
  const normalized = normalizeApiError(error);

  return NextResponse.json(
    {
      error: normalized.message,
      details: normalized.details,
    },
    {
      status: normalized.status,
    },
  );
}

