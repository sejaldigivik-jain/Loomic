/**
 * PATCH /api/v1/auth/me/password
 *
 * Change the authenticated user's password. Requires the current password
 * for verification — prevents session hijacking from being able to change
 * the password directly.
 *
 * Body: { currentPassword: string, newPassword: string }
 *
 * Requires: Authorization: Bearer <accessToken>
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { getBearerToken, verifyToken, verifyPassword, hashPassword, type AccessTokenPayload } from "@/lib/auth";

export const runtime = "nodejs";

const schema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(128),
});

export const PATCH = withHandler(schema, async ({ req, body }) => {
  const token = getBearerToken(req);
  if (!token) throw ApiError.unauthorized("Missing bearer token");
  const payload = verifyToken<AccessTokenPayload>(token);
  if (!payload || payload.type !== "access") {
    throw ApiError.unauthorized("Invalid or expired token");
  }

  const user = await db.user.findUnique({ where: { id: payload.sub } });
  if (!user) throw ApiError.notFound("User not found");
  if (!user.passwordHash) {
    throw ApiError.badRequest("Account has no password set (OAuth-only account)");
  }

  // Verify current password
  const valid = await verifyPassword(body!.currentPassword, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized("Current password is incorrect");
  }

  // New password must differ from current
  if (body!.currentPassword === body!.newPassword) {
    throw ApiError.badRequest("New password must be different from your current password");
  }

  // Hash + save
  const newHash = await hashPassword(body!.newPassword);
  await db.user.update({
    where: { id: user.id },
    data: { passwordHash: newHash },
  });

  return ok({ success: true });
});
