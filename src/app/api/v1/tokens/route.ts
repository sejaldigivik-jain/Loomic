/**
 * GET  /api/v1/tokens — list the current user's API tokens
 * POST /api/v1/tokens — generate a new token (returns the raw token ONCE)
 *
 * Requires: Authorization: Bearer <accessToken>
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { getBearerToken, verifyToken, generateApiToken, type AccessTokenPayload } from "@/lib/auth";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req }) => {
  const token = getBearerToken(req);
  if (!token) throw ApiError.unauthorized("Missing bearer token");
  const payload = verifyToken<AccessTokenPayload>(token);
  if (!payload || payload.type !== "access") {
    throw ApiError.unauthorized("Invalid or expired token");
  }

  const tokens = await db.apiToken.findMany({
    where: { userId: payload.sub, revokedAt: null },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      lastUsedAt: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return ok(tokens);
});

const createSchema = z.object({
  name: z.string().min(1).max(80),
  scopes: z.enum(["read", "write", "admin"]).default("write"),
});

export const POST = withHandler(createSchema, async ({ req, body }) => {
  const token = getBearerToken(req);
  if (!token) throw ApiError.unauthorized("Missing bearer token");
  const payload = verifyToken<AccessTokenPayload>(token);
  if (!payload || payload.type !== "access") {
    throw ApiError.unauthorized("Invalid or expired token");
  }

  // Generate the raw token + its hash (only the hash is stored)
  const { token: rawToken, hash, prefix } = generateApiToken();

  const record = await db.apiToken.create({
    data: {
      userId: payload.sub,
      name: body!.name,
      tokenHash: hash,
      prefix,
      scopes: body!.scopes,
      // Tokens don't expire by default (user can revoke anytime)
      expiresAt: null,
    },
    select: {
      id: true,
      name: true,
      prefix: true,
      scopes: true,
      createdAt: true,
    },
  });

  // Return the RAW token — this is the only time it's visible to the user
  return ok({ ...record, token: rawToken }, {}, 201);
});
