/**
 * API utilities — shared helpers for every route handler.
 *
 * Centralises:
 *   • Typed success / error responses
 *   • A standard error envelope
 *   • Zod request validation with automatic 400 mapping
 *   • A thin async handler wrapper that catches thrown errors
 *   • Pagination helpers
 *
 * Keeping these in one place means every route returns the same shape,
 * which makes the frontend TanStack Query layer trivial to write.
 */
import { NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";

/* -------------------------------------------------------------------------- */
/*  Response shapes                                                            */
/* -------------------------------------------------------------------------- */

/** Standard success envelope: `{ data, meta }` */
export function ok<T>(data: T, meta?: Record<string, unknown>, status = 200) {
  return NextResponse.json({ data, meta: meta ?? {} }, { status });
}

/** Standard error envelope: `{ error: { code, message, details? } }` */
export function fail(
  code: string,
  message: string,
  status: number,
  details?: unknown
) {
  return NextResponse.json(
    { error: { code, message, ...(details ? { details } : {}) } },
    { status }
  );
}

/* -------------------------------------------------------------------------- */
/*  Typed error — thrown inside handlers, mapped by `withHandler`             */
/* -------------------------------------------------------------------------- */

export class ApiError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: number = 400,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = "ApiError";
  }

  static badRequest(message = "Bad request", details?: unknown) {
    return new ApiError("bad_request", message, 400, details);
  }
  static unauthorized(message = "Unauthorized") {
    return new ApiError("unauthorized", message, 401);
  }
  static forbidden(message = "Forbidden") {
    return new ApiError("forbidden", message, 403);
  }
  static notFound(message = "Not found") {
    return new ApiError("not_found", message, 404);
  }
  static conflict(message = "Conflict") {
    return new ApiError("conflict", message, 409);
  }
  static rateLimited(message = "Too many requests", retryAfter?: number) {
    return new ApiError("rate_limited", message, 429, { retryAfter });
  }
  static internal(message = "Internal server error") {
    return new ApiError("internal", message, 500);
  }
}

/* -------------------------------------------------------------------------- */
/*  Handler wrapper — eliminates try/catch boilerplate in every route         */
/* -------------------------------------------------------------------------- */

type Handler = (req: Request, ctx: { params: Record<string, string | string[]> }) => Promise<Response> | Response;

/**
 * Wraps a route handler with:
 *   • try/catch → uniform error envelope
 *   • Zod validation on JSON body (optional)
 *   • Request logging (method, path, status, duration)
 *
 * In Next.js 16, `params` is a Promise — we await it here so route
 * handlers can keep using the synchronous `ctx.params.id` access pattern.
 */
export function withHandler<TBody>(schema: ZodSchema<TBody> | null, handler: (args: {
  req: Request;
  ctx: { params: Record<string, string | string[]> };
  body: TBody | null;
}) => Promise<Response> | Response): Handler {
  // The actual Next.js route handler signature accepts params as a Promise
  // in Next 16, so we cast through `any` to handle both shapes safely.
  return async (req: Request, ctx: any) => {
    const started = Date.now();
    const url = new URL(req.url);
    try {
      // Await params (Promise in Next.js 16, plain object in older versions)
      const rawParams =
        ctx?.params && typeof (ctx.params as Promise<unknown>).then === "function"
          ? await (ctx.params as Promise<Record<string, string | string[]>>)
          : (ctx?.params as Record<string, string | string[]>);
      const safeCtx = { ...ctx, params: rawParams ?? {} };

      let body: TBody | null = null;
      if (schema && req.method !== "GET" && req.method !== "DELETE") {
        try {
          const json = await req.json();
          body = schema.parse(json);
        } catch (err) {
          if (err instanceof ZodError) {
            return fail("validation_error", "Request validation failed", 422, err.flatten());
          }
          throw err;
        }
      }
      const res = await handler({ req, ctx: safeCtx, body });
      console.log(`[api] ${req.method} ${url.pathname} → ${res.status} (${Date.now() - started}ms)`);
      return res;
    } catch (err) {
      if (err instanceof ApiError) {
        return fail(err.code, err.message, err.status, err.details);
      }
      // Zod errors thrown inside handler logic
      if (err instanceof ZodError) {
        return fail("validation_error", "Request validation failed", 422, err.flatten());
      }
      console.error("[api] unhandled error:", err);

      // A fresh local checkout used to surface an unhelpful generic 500 when
      // Prisma had not been initialized yet. `npm run dev` now bootstraps the
      // database automatically, but this diagnostic keeps manual/custom starts
      // understandable instead of leaving the registration modal at
      // “Internal server error”. Production responses remain intentionally
      // generic and do not leak infrastructure details.
      if (process.env.NODE_ENV !== "production") {
        const prismaLike = err as { name?: string; code?: string; message?: string };
        const message = prismaLike?.message ?? "";
        const isDatabaseSetupError =
          prismaLike?.name?.includes("PrismaClient") ||
          ["P1001", "P1003", "P1012", "P2021", "P2022"].includes(prismaLike?.code ?? "") ||
          /DATABASE_URL|database .* does not exist|table .* does not exist|no such table|no such column/i.test(message);

        if (isDatabaseSetupError) {
          return fail(
            "database_not_ready",
            "Local database is not ready. Stop the dev server, run `npm run repair`, then run `npm run dev` again.",
            503
          );
        }

        return fail(
          "internal",
          message ? `Development server error: ${message}` : "Development server error",
          500
        );
      }

      return fail("internal", "Internal server error", 500);
    }
  };
}

/* -------------------------------------------------------------------------- */
/*  Pagination                                                                  */
/* -------------------------------------------------------------------------- */

export interface PaginationParams {
  page: number;
  pageSize: number;
}

export function parsePagination(search: URLSearchParams): PaginationParams {
  const page = Math.max(1, Number(search.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(search.get("pageSize") ?? "20")));
  return { page, pageSize };
}

export function paginateMeta(total: number, { page, pageSize }: PaginationParams) {
  return {
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
    hasMore: page * pageSize < total,
  };
}

/* -------------------------------------------------------------------------- */
/*  Sorting / filtering helpers                                                */
/* -------------------------------------------------------------------------- */

const ALLOWED_SORT_DIRECTIONS = ["asc", "desc"] as const;
type SortDir = (typeof ALLOWED_SORT_DIRECTIONS)[number];

export function parseSort(search: URLSearchParams, allowed: string[], fallback: string): { field: string; dir: SortDir } {
  const field = search.get("sortBy") ?? fallback;
  const dirRaw = (search.get("sortDir") ?? "desc").toLowerCase() as SortDir;
  if (!allowed.includes(field)) return { field: fallback, dir: "desc" };
  if (!ALLOWED_SORT_DIRECTIONS.includes(dirRaw)) return { field, dir: "desc" };
  return { field, dir: dirRaw };
}
