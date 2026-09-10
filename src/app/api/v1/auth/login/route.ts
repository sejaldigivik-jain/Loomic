/**
 * POST /api/v1/auth/login
 *
 * Verifies email + password, issues fresh access + refresh tokens,
 * and records a Session row for device tracking & revocation.
 *
 * Body: { email, password }
 * Response: { user, accessToken } + HttpOnly refresh cookie
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { verifyPassword, signAccessToken, signRefreshToken } from "@/lib/auth";
import { assertRateLimit } from "@/lib/rate-limit";
import { setRefreshCookie } from "@/lib/auth-cookie";

const schema = z.object({
  email: z.string().email().toLowerCase(),
  password: z.string().min(1),
});

export const runtime = "nodejs";

export const POST = withHandler(schema, async ({ req, body }) => {
  const { email, password } = body!;
  assertRateLimit(req, { namespace: "auth-login", limit: 10, windowMs: 15 * 60_000, discriminator: email });

  const user = await db.user.findUnique({ where: { email } });
  if (!user || !user.passwordHash || user.deletedAt) {
    // Use the same message for "no account" and "wrong password" to
    // avoid user-enumeration oracles.
    throw ApiError.unauthorized("Invalid email or password");
  }

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    throw ApiError.unauthorized("Invalid email or password");
  }

  // Record a session for this device
  const jti = crypto.randomUUID();
  const expires = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30);
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0] ?? null;
  const userAgent = req.headers.get("user-agent") ?? null;

  await db.session.create({
    data: { userId: user.id, sessionToken: jti, ip, userAgent, expires },
  });

  const membership = await db.membership.findFirst({
    where: { userId: user.id, isActive: true },
    select: { workspaceId: true, role: true },
  });
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    workspaceId: membership?.workspaceId ?? user.defaultWorkspaceId ?? undefined,
    role: membership?.role,
  });
  const refreshToken = signRefreshToken({ sub: user.id, jti });

  const response = ok({
    user: { id: user.id, email: user.email, name: user.name },
    accessToken,
  });
  return setRefreshCookie(response, refreshToken);
});
