import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { signAccessToken, signRefreshToken, verifyToken, type RefreshTokenPayload } from "@/lib/auth";
import { readRequestCookie, REFRESH_COOKIE, setRefreshCookie } from "@/lib/auth-cookie";
import { assertRateLimit } from "@/lib/rate-limit";

// Body token remains optional for backward compatibility with older clients.
// Current web clients use only the HttpOnly cookie.
const schema = z.object({ refreshToken: z.string().min(20).optional() });
export const runtime = "nodejs";

export const POST = withHandler(schema, async ({ req, body }) => {
  assertRateLimit(req, { namespace: "auth-refresh", limit: 30, windowMs: 15 * 60_000 });
  const token = readRequestCookie(req, REFRESH_COOKIE) ?? body?.refreshToken;
  if (!token) throw ApiError.unauthorized("Refresh session is missing");

  const payload = verifyToken<RefreshTokenPayload>(token);
  if (!payload || payload.type !== "refresh") throw ApiError.unauthorized("Invalid or expired refresh token");
  const session = await db.session.findUnique({ where: { sessionToken: payload.jti }, include: { user: true } });
  if (!session || session.userId !== payload.sub || session.user.deletedAt || session.revokedAt || session.expires < new Date()) {
    throw ApiError.unauthorized("Refresh session is no longer valid");
  }

  const membership = await db.membership.findFirst({
    where: { userId: session.userId, isActive: true },
    select: { workspaceId: true, role: true },
  });
  const nextJti = crypto.randomUUID();
  await db.$transaction([
    db.session.update({ where: { id: session.id }, data: { revokedAt: new Date() } }),
    db.session.create({
      data: {
        userId: session.userId,
        sessionToken: nextJti,
        ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
        userAgent: req.headers.get("user-agent") ?? null,
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
      },
    }),
  ]);

  const response = ok({
    accessToken: signAccessToken({
      sub: session.user.id,
      email: session.user.email,
      workspaceId: membership?.workspaceId,
      role: membership?.role,
    }),
  });
  return setRefreshCookie(response, signRefreshToken({ sub: session.user.id, jti: nextJti }));
});
