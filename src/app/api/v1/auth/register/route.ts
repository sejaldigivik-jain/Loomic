/**
 * POST /api/v1/auth/register
 *
 * Creates a new user account with email/password, hashes the password,
 * issues access + refresh tokens, and provisions a default workspace.
 *
 * Body: { name?: string, email: string, password: string }
 * Response: { user, accessToken } + HttpOnly refresh cookie
 */
import { z } from "zod";
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { hashPassword, signAccessToken, signRefreshToken } from "@/lib/auth";
import { assertRateLimit } from "@/lib/rate-limit";
import { setRefreshCookie } from "@/lib/auth-cookie";

const schema = z.object({
  name: z.string().min(1).max(80).optional(),
  email: z.string().email().toLowerCase(),
  password: z.string().min(8).max(128),
});

export const runtime = "nodejs";

export const POST = withHandler(schema, async ({ req, body }) => {
  const { name, email, password } = body!;
  assertRateLimit(req, { namespace: "auth-register", limit: 5, windowMs: 60 * 60_000, discriminator: email });

  // Prevent duplicate accounts
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    throw ApiError.conflict("An account with this email already exists");
  }

  const passwordHash = await hashPassword(password);

  // Create user + default workspace + membership atomically
  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email,
        name,
        passwordHash,
        onboardingState: "pending",
      },
    });

    const slug = `${email.split("@")[0]}-${Math.random().toString(36).slice(2, 8)}`;
    const workspace = await tx.workspace.create({
      data: {
        name: name ? `${name}'s workspace` : "My workspace",
        slug,
      },
    });

    await tx.membership.create({
      data: {
        userId: u.id,
        workspaceId: workspace.id,
        role: "owner",
        isActive: true,
      },
    });

    await tx.user.update({
      where: { id: u.id },
      data: { defaultWorkspaceId: workspace.id },
    });

    return u;
  });

  const membership = await db.membership.findFirst({
    where: { userId: user.id, isActive: true },
    select: { workspaceId: true, role: true },
  });
  const jti = crypto.randomUUID();
  await db.session.create({
    data: {
      userId: user.id,
      sessionToken: jti,
      ip: req.headers.get("x-forwarded-for")?.split(",")[0] ?? null,
      userAgent: req.headers.get("user-agent") ?? null,
      expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30),
    },
  });
  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    workspaceId: membership?.workspaceId,
    role: membership?.role,
  });
  const refreshToken = signRefreshToken({ sub: user.id, jti });

  const response = ok(
    {
      user: { id: user.id, email: user.email, name: user.name },
      accessToken,
    },
    {},
    201
  );
  return setRefreshCookie(response, refreshToken);
});
