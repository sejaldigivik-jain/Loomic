/**
 * DELETE /api/v1/tokens/:id — revoke (soft-delete) an API token
 *
 * Requires: Authorization: Bearer <accessToken>
 */
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { getBearerToken, verifyToken, type AccessTokenPayload } from "@/lib/auth";

export const runtime = "nodejs";

export const DELETE = withHandler(null, async ({ req, ctx }) => {
  const token = getBearerToken(req);
  if (!token) throw ApiError.unauthorized("Missing bearer token");
  const payload = verifyToken<AccessTokenPayload>(token);
  if (!payload || payload.type !== "access") {
    throw ApiError.unauthorized("Invalid or expired token");
  }

  const tokenId = String(ctx.params.id);

  // Verify the token belongs to the authenticated user
  const existing = await db.apiToken.findUnique({ where: { id: tokenId } });
  if (!existing || existing.userId !== payload.sub) {
    throw ApiError.notFound("Token not found");
  }

  // Soft-delete: set revokedAt instead of hard-deleting (preserves audit trail)
  await db.apiToken.update({
    where: { id: tokenId },
    data: { revokedAt: new Date() },
  });

  return ok({ id: tokenId, revoked: true });
});
