import { z } from "zod";
import { db } from "@/lib/db";
import { ApiError, ok, withHandler } from "@/lib/api-utils";
import { hashPassword, verifyPasswordResetToken } from "@/lib/auth";
import { assertRateLimit } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  token: z.string().min(20),
  password: z.string().min(8).max(128),
});

export const POST = withHandler(schema, async ({ req, body }) => {
  assertRateLimit(req, { namespace: "auth-reset", limit: 10, windowMs: 15 * 60_000 });
  const decoded = (() => {
    try {
      const encoded = body!.token.split(".")[0];
      return JSON.parse(Buffer.from(encoded, "base64url").toString("utf-8")) as { sub?: string };
    } catch {
      return null;
    }
  })();
  if (!decoded?.sub) throw ApiError.badRequest("This password reset link is invalid or expired");

  const user = await db.user.findUnique({ where: { id: decoded.sub } });
  const verified = user?.passwordHash ? verifyPasswordResetToken(body!.token, user.passwordHash) : null;
  if (!user || user.deletedAt || !verified || verified.email !== user.email) {
    throw ApiError.badRequest("This password reset link is invalid or expired");
  }

  const passwordHash = await hashPassword(body!.password);
  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash } }),
    db.session.deleteMany({ where: { userId: user.id } }),
  ]);

  return ok({ reset: true });
});
