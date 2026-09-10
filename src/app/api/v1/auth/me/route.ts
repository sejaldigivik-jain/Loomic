/**
 * GET /api/v1/auth/me
 *
 * Returns the currently authenticated user's profile + active workspace
 * membership. Requires `Authorization: Bearer <accessToken>`.
 */
import { db } from "@/lib/db";
import { withHandler, ok, ApiError } from "@/lib/api-utils";
import { getBearerToken, verifyToken, type AccessTokenPayload } from "@/lib/auth";

export const runtime = "nodejs";

export const GET = withHandler(null, async ({ req }) => {
  const token = getBearerToken(req);
  if (!token) throw ApiError.unauthorized("Missing bearer token");

  const payload = verifyToken<AccessTokenPayload>(token);
  if (!payload || payload.type !== "access") {
    throw ApiError.unauthorized("Invalid or expired token");
  }

  const user = await db.user.findUnique({
    where: { id: payload.sub },
    select: {
      id: true,
      email: true,
      name: true,
      image: true,
      theme: true,
      onboardingState: true,
      defaultWorkspaceId: true,
      preferences: true,
      createdAt: true,
    },
  });
  if (!user) throw ApiError.notFound("User not found");

  // Parse preferences JSON to extract bio + notification settings
  const prefs = user.preferences ? JSON.parse(user.preferences) : {};

  const memberships = await db.membership.findMany({
    where: { userId: user.id },
    include: { workspace: { select: { id: true, name: true, slug: true } } },
  });

  return ok({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
      theme: user.theme,
      onboardingState: user.onboardingState,
      defaultWorkspaceId: user.defaultWorkspaceId,
      createdAt: user.createdAt,
      bio: prefs.bio ?? "",
      notifications: prefs.notifications ?? {
        postPublished: true,
        postFailed: true,
        comments: true,
        teamActivity: false,
        weeklyDigest: true,
        productUpdates: false,
      },
    },
    workspaces: memberships.map((m) => ({
      id: m.workspace.id,
      name: m.workspace.name,
      slug: m.workspace.slug,
      role: m.role,
      isActive: m.isActive,
    })),
  });
});
