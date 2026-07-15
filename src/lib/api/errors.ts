import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { Prisma } from "@prisma/client";
import { RateEngineError } from "@/lib/domain/rate-engine";
import { InvalidTransitionError } from "@/lib/domain/status-machine";
import { QuoteError } from "@/lib/orders/pricing";

/** An error carrying an HTTP status; thrown from handlers and mapped below. */
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (m: string, d?: unknown) => new ApiError(400, m, d);
export const unauthorized = (m = "Not authenticated") => new ApiError(401, m);
export const forbidden = (m = "Forbidden") => new ApiError(403, m);
export const notFound = (m = "Not found") => new ApiError(404, m);
export const conflict = (m: string) => new ApiError(409, m);

function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

/** Maps any thrown value to a consistent JSON error response. */
export function mapErrorToResponse(err: unknown): NextResponse {
  if (err instanceof ApiError) return jsonError(err.status, err.message, err.details);
  if (err instanceof ZodError) return jsonError(422, "Validation failed", err.flatten());
  if (err instanceof RateEngineError) return jsonError(422, err.message);
  if (err instanceof QuoteError) return jsonError(422, err.message);
  if (err instanceof InvalidTransitionError) return jsonError(409, err.message);

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return jsonError(409, "A record with this unique value already exists");
    }
    if (err.code === "P2025") return jsonError(404, "Record not found");
    if (err.code === "P2003") return jsonError(409, "Referenced record does not exist");
    return jsonError(400, "Database request error");
  }

  console.error("Unhandled API error:", err);
  return jsonError(500, "Internal server error");
}

/** Wraps a route handler so thrown errors become consistent JSON responses. */
export function withApi<A extends unknown[]>(
  handler: (...args: A) => Promise<NextResponse>,
) {
  return async (...args: A): Promise<NextResponse> => {
    try {
      return await handler(...args);
    } catch (err) {
      return mapErrorToResponse(err);
    }
  };
}
